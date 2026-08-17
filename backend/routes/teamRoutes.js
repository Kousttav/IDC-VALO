const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { imageUpload } = require('../utils/multerConfig');
const {
  getTeams,
  getTeamWithRoster,
  createTeam,
  updateTeam,
  deleteTeam,
} = require('../controllers/teamController');

// Public
router.get('/', getTeams);
router.get('/:id', getTeamWithRoster);

// Admin only
router.post('/', verifyToken, requireAdmin, imageUpload.single('logo'), createTeam);
router.put('/:id', verifyToken, requireAdmin, imageUpload.single('logo'), updateTeam);
router.delete('/:id', verifyToken, requireAdmin, deleteTeam);

module.exports = router;
