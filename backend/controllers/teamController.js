const Team = require('../models/Team');
const Player = require('../models/Player');
const { uploadMulterFileToCloudinary, deleteFromCloudinary } = require('../utils/uploadToCloudinary');

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });
    // attach player counts so the roster page can show squad size without a second round trip
    const counts = await Player.aggregate([{ $group: { _id: '$team', count: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json(teams.map((t) => ({ ...t.toObject(), playerCount: countMap[String(t._id)] || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeamWithRoster = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    // IGLs first (mainRole === 'IGL'), then alphabetical by IGN/tag
    const players = await Player.find({ team: team._id }).collation({ locale: 'en' }).sort({ ignTag: 1 });
    players.sort((a, b) => (a.mainRole === 'IGL' ? -1 : 0) - (b.mainRole === 'IGL' ? -1 : 0));
    res.json({ team, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, tagline, region, primaryColor, accentColor } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required.' });

    let logo = '';
    if (req.file) logo = await uploadMulterFileToCloudinary(req.file, 'idc-valorant/teams');
    else if (req.body.logoUrl) logo = req.body.logoUrl;

    const team = await Team.create({
      name,
      slug: slugify(name),
      logo,
      tagline: tagline || '',
      region: region || 'APAC',
      theme: { primaryColor: primaryColor || '#e6432b', accentColor: accentColor || '#b8935a' },
    });

    req.app.get('io')?.emit('team:created', team);
    res.status(201).json(team);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A team with that name already exists.' });
    res.status(500).json({ error: err.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.name) body.slug = slugify(body.name);

    if (req.file) {
      const existing = await Team.findById(req.params.id);
      const newLogo = await uploadMulterFileToCloudinary(req.file, 'idc-valorant/teams');
      if (existing?.logo && newLogo) await deleteFromCloudinary(existing.logo);
      body.logo = newLogo;
    }

    const team = await Team.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    req.app.get('io')?.emit('team:updated', team);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.logo) await deleteFromCloudinary(team.logo);
    await Player.updateMany({ team: team._id }, { $set: { team: null } });

    req.app.get('io')?.emit('team:deleted', { id: team._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};