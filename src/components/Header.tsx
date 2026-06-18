import styles from '../styles/chrome.module.scss'

export function Header() {
  return (
    <header className={styles.header}>
      <img className={styles.logo} src="./images/logo-nw-neu.png" alt="Nerdware" />
      <h1>Tech Radar</h1>
    </header>
  )
}
