import './admin-styles';
import './lib/admin-translations';
import { createRoot } from 'react-dom/client';
import { AdminWorkspace } from './views/AdminWorkspace';
createRoot(document.getElementById('root')).render(<AdminWorkspace/>);
