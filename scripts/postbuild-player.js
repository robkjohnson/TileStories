// After building the player app, copy player.html → index.html
// so the Express server can find it at the root route
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'player-dist')
const playerHtml = path.join(dist, 'player.html')
const indexHtml  = path.join(dist, 'index.html')

if (fs.existsSync(playerHtml)) {
  fs.copyFileSync(playerHtml, indexHtml)
  console.log('✓ Copied player.html → index.html in player-dist')
} else {
  console.error('✗ player.html not found in player-dist')
}