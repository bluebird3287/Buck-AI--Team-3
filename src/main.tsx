import {createRoot} from 'react-dom/client';
import { AuthGate } from './components/AuthGate';
import { UpdateChecker } from './components/UpdateChecker';
import './index.css';
import { trackVisitOnLoad } from './lib/tracking';

trackVisitOnLoad();

createRoot(document.getElementById('root')!).render(
  <>
    <UpdateChecker />
    <AuthGate />
  </>,
);
