const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { imageUpload, excelUpload } = require('../utils/multerConfig');
const {
  getPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  bulkImportPlayers,
} = require('../controllers/playerController');

const picUpload = imageUpload.single('pic');

// Public
router.get('/', getPlayers);
router.get('/:id', getPlayer);

// Admin only
router.post('/', verifyToken, requireAdmin, picUpload, createPlayer);
router.put('/:id', verifyToken, requireAdmin, picUpload, updatePlayer);
router.delete('/:id', verifyToken, requireAdmin, deletePlayer);
router.post('/bulk-import', verifyToken, requireAdmin, excelUpload.single('file'), bulkImportPlayers);

module.exports = router;