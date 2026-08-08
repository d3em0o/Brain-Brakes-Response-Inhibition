import './styles/main.css';
import { GameController } from './game/GameController';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing app root.');
}

new GameController(root);
