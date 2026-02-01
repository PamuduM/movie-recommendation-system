const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const validateRequest = require('../middleware/validateRequest');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/register', [
  body('username').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 8 })
], validateRequest, userController.register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], validateRequest, userController.login);

router.get('/me', auth, userController.getMe);

router.put('/me', auth, [
  body('username').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('avatar').optional().isString(),
  body('bio').optional().isString(),
], validateRequest, userController.updateProfile);

router.post('/password-reset/request', [
  body('email').isEmail(),
], validateRequest, userController.requestPasswordReset);

router.post('/password-reset/confirm', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], validateRequest, userController.resetPassword);

router.post('/verify-email/request', [
  body('email').isEmail(),
], validateRequest, userController.requestEmailVerification);

router.post('/verify-email/confirm', [
  body('token').notEmpty(),
], validateRequest, userController.verifyEmail);

// Add more user routes as needed

module.exports = router;
