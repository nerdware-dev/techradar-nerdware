import { BLIP_RADIUS } from '../config'
import styles from '../styles/blip.module.scss'

/** The badge sits on the dot's upper-right rim (45°). */
const OFFSET = BLIP_RADIUS * Math.SQRT1_2

/** Marks a blip as new; drawn on top of a dot centred at the origin. */
export function NewBadge() {
  return <circle data-isnew="true" className={styles.newBadge} cx={OFFSET} cy={-OFFSET} r={3.2} />
}
