import { Router } from 'express';
import { handleChat } from '../controllers/chatController';

export const chatRouter = Router();

// Handle conversational interactions
chatRouter.post('/', handleChat);
