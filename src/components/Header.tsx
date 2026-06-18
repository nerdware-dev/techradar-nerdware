import styles from '../styles/chrome.module.scss'

export function Header() {
  return (
    <header className={styles.header}>
      <img className={styles.logo} src="./images/logo-nw-neu.png" alt="Nerdware" />
      <h1 className={styles.title}>
        Tech <span className={styles.titleAccent}>Radar</span>
      </h1>
    </header>
  )
}
