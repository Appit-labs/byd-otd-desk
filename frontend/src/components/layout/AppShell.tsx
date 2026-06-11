import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.sidebarArea}>
        <Sidebar />
      </div>
      <div className={styles.topbarArea}>
        <TopBar />
      </div>
      <main className={styles.mainArea}>
        <Outlet />
      </main>
    </div>
  );
}
