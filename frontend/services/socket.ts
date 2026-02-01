import { io } from 'socket.io-client';
import { Platform } from 'react-native';

const SOCKET_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const SOCKET_URL = `http://${SOCKET_HOST}:5000`;
export const socket = io(SOCKET_URL);
