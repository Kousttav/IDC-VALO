const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const crypto = require('crypto');
const Player = require('../models/Player');
const User = require('../models/User');
const { uploadMulterFileToCloudinary, uploadDriveLinkToCloudinary, deleteFromCloudinary } = require('../utils/uploadToCloudinary');

// If accessLevel is admin/staff, make sure a matching User login exists (create or sync role).
// Returns a plaintext password ONLY when a brand new account was generated, so the admin can hand it off once.
async function syncPlayerAccess(player, accessLevel) {
  if (accessLevel === 'none') {
    if (player.username) {
      await User.deleteOne({ linkedPlayer: player._id });
      player.username = undefined;
      player.passwordHash = undefined;
    }
    return null;
  }

  let generatedPassword = null;
  let user = await User.findOne({ linkedPlayer: player._id });

  if (!user) {
    const baseUsername = player.ignTag.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player';
    let username = baseUsername;
    let n = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${n++}`;
    }
    generatedPassword = crypto.randomBytes(6).toString('hex'); // e.g. "a3f9c1d0e2b7"
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    user = await User.create({ username, passwordHash, role: accessLevel, linkedPlayer: player._id });
    player.username = username;
  } else if (user.role !== accessLevel) {
    user.role = accessLevel;
    await user.save();
  }

  return generatedPassword;
}

exports.getPlayers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.team) filter.team = req.query.team;
    const players = await Player.find(filter).populate('team', 'name slug logo theme').sort({ ignTag: 1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('team', 'name slug logo theme');
    if (!player) return res.status(404).json({ error: 'Player not found.' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPlayer = async (req, res) => {
  try {
    const body = { ...req.body };

    // age is a derived virtual (see Player model) — never trust/store whatever the client computed
    delete body.age;

    // FormData sends "" for an unassigned team, but that's not a valid ObjectId — null it out
    if (body.team === '') body.team = null;

    if (req.file) {
      body.pic = await uploadMulterFileToCloudinary(req.file, 'idc-valorant/players');
    } else if (body.picDriveLink && body.picDriveLink.trim()) {
      body.pic = await uploadDriveLinkToCloudinary(body.picDriveLink.trim(), 'idc-valorant/players');
    }
    delete body.picDriveLink;

    const accessLevel = body.accessLevel || 'none';
    delete body.accessLevel;

    const player = new Player(body);
    await player.save();

    const generatedPassword = await syncPlayerAccess(player, accessLevel);
    player.accessLevel = accessLevel;
    await player.save();

    req.app.get('io')?.emit('player:created', player);
    res.status(201).json({
      player,
      credentials: generatedPassword ? { username: player.username, password: generatedPassword } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.age;
    if (body.team === '') body.team = null;

    const existing = await Player.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Player not found.' });

    if (req.file) {
      const url = await uploadMulterFileToCloudinary(req.file, 'idc-valorant/players');
      if (existing.pic) await deleteFromCloudinary(existing.pic);
      body.pic = url;
    } else if (body.picDriveLink && body.picDriveLink.trim()) {
      const url = await uploadDriveLinkToCloudinary(body.picDriveLink.trim(), 'idc-valorant/players');
      if (existing.pic) await deleteFromCloudinary(existing.pic);
      body.pic = url;
    }
    delete body.picDriveLink;

    const accessLevel = body.accessLevel;
    delete body.accessLevel;

    Object.assign(existing, body);
    await existing.save();

    let generatedPassword = null;
    if (accessLevel) {
      generatedPassword = await syncPlayerAccess(existing, accessLevel);
      existing.accessLevel = accessLevel;
      await existing.save();
    }

    req.app.get('io')?.emit('player:updated', existing);
    res.json({
      player: existing,
      credentials: generatedPassword ? { username: existing.username, password: generatedPassword } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    const deleted = await Player.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Player not found.' });

    if (deleted.pic) await deleteFromCloudinary(deleted.pic);
    await User.deleteOne({ linkedPlayer: deleted._id });

    req.app.get('io')?.emit('player:deleted', { id: deleted._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/*
  POST /api/players/bulk-import  (multipart, field name "file")
  Expected Excel / form-export columns (header row, case-insensitive):
  timestamp | email | fullName | discordUsername | age (ignored — always derived from dob) |
  contactNumber | dob (YYYY-MM-DD) | languages | ignTag | preferredServer | mainRole |
  secondaryRole | currentRank | peakRank | trackerLink | team (team name — matched/created) |
  <any header containing "pic"/"photo"/"image"/"drive"> (Google Drive share link — pulled
  and uploaded to Cloudinary; column name is matched loosely since Forms/Excel headers vary)
*/
exports.bulkImportPlayers = async (req, res) => {
  const Team = require('../models/Team');
  try {
    if (!req.file) return res.status(400).json({ error: 'No Excel file uploaded (field name "file").' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const results = { created: 0, failed: [], warnings: [] };

    for (const [i, row] of rows.entries()) {
      try {
        const norm = {};
        Object.keys(row).forEach((k) => (norm[k.toLowerCase().trim()] = row[k]));

        if (!norm.igntag || !norm.dob || !norm.email || !norm.fullname) {
          throw new Error('Missing required field(s): ignTag, email, fullName, dob');
        }

        let teamId = null;
        if (norm.team) {
          const teamName = String(norm.team).trim();
          let team = await Team.findOne({ name: teamName });
          if (!team) {
            team = await Team.create({
              name: teamName,
              slug: teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            });
          }
          teamId = team._id;
        }

        const dob = norm.dob instanceof Date ? norm.dob : new Date(norm.dob);
        if (isNaN(dob.getTime())) throw new Error('Invalid dob — use YYYY-MM-DD');

        let timestamp = new Date();
        if (norm.timestamp) {
          const parsed = norm.timestamp instanceof Date ? norm.timestamp : new Date(norm.timestamp);
          if (!isNaN(parsed.getTime())) timestamp = parsed;
        }

        // Pull the image from whichever column looks like a photo/drive-link field —
        // match loosely since Excel/Google Forms headers vary in exact wording
        // (e.g. "Upload Your Photo", "Profile Pic Link", "Player Picture (Drive link)").
        let pic = undefined;
        let picWarning = null;
        const picKey = Object.keys(norm).find((k) => /pic|photo|image|drive/i.test(k));
        const driveLink = picKey ? norm[picKey] : '';

        if (driveLink && String(driveLink).trim()) {
          try {
            pic = await uploadDriveLinkToCloudinary(String(driveLink).trim(), 'idc-valorant/players');
          } catch (picErr) {
            // Don't fail the whole row over a bad image link — create the player without a pic,
            // but surface exactly why in the response instead of only a server-side console.warn.
            picWarning = `image not imported (column "${picKey}"): ${picErr.message}`;
          }
        } else if (!picKey) {
          // No column even matched — dump the headers we saw so this is diagnosable
          // straight from the API response instead of guessing.
          picWarning = `no photo/drive-link column detected — headers found: ${Object.keys(norm).join(', ')}`;
        }

        await Player.create({
          email: String(norm.email).trim().toLowerCase(),
          fullName: String(norm.fullname).trim(),
          discordUsername: String(norm.discordusername || '').trim(),
          contactNumber: String(norm.contactnumber || '').trim(),
          dob,
          languages: norm.languages || '',
          ignTag: String(norm.igntag).trim(),
          preferredServer: norm.preferredserver || '',
          mainRole: norm.mainrole || 'Flex',
          secondaryRole: norm.secondaryrole || '',
          currentRank: norm.currentrank || undefined,
          peakRank: norm.peakrank || '',
          trackerLink: norm.trackerlink || '',
          team: teamId,
          timestamp,
          ...(pic ? { pic } : {}),
        });
        results.created++;

        if (picWarning) {
          results.warnings.push({ row: i + 2, warning: picWarning });
        }
      } catch (rowErr) {
        results.failed.push({ row: i + 2, error: rowErr.message }); // +2 = header row + 1-index
      }
    }

    if (results.warnings.length === 0) delete results.warnings;

    req.app.get('io')?.emit('player:bulk-imported', results);
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};