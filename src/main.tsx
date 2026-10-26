import {createRoot} from 'react-dom/client';
import { AuthGate } from './components/AuthGate';
import { UpdateChecker } from './components/UpdateChecker';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <UpdateChecker />
    <AuthGate />
  </>,
);
