/* ============================================================
   STREAM TOOLKIT — CONFIGURATION
   ============================================================
   Edit the values below with your own credentials and
   preferences. See README.md for step-by-step instructions
   on how to get each value.
   ============================================================ */

const TOOLKIT_CONFIG = {

  /* ----------------------------------------------------------
     TWITCH API
     Used to seed the ticker with your current followers
     and bits leaderboard on startup.
     ---------------------------------------------------------- */
  twitch: {
    clientId:    'YOUR_TWITCH_CLIENT_ID',
    oauthToken:  'YOUR_TWITCH_OAUTH_TOKEN',
  },

  /* ----------------------------------------------------------
     STREAMLABS SOCKET API
     Captures real-time follow, sub, cheer, and tip events
     during your stream. Data persists between streams.
     ---------------------------------------------------------- */
  streamlabs: {
    socketToken: 'YOUR_STREAMLABS_SOCKET_TOKEN',
  },

  /* ----------------------------------------------------------
     EXTRA LIFE
     Set enabled to true and enter your Participant ID to
     show donation data and a QR "Scan to Donate" page.
     Your Participant ID is the number in your Extra Life URL:
     extra-life.org/participant/XXXXXX
     ---------------------------------------------------------- */
  extraLife: {
    enabled:       false,
    participantId: 'YOUR_PARTICIPANT_ID',
  },

  /* ----------------------------------------------------------
     TICKER APPEARANCE
     Customize the ESPN-style bottom ticker colors and sizing.
     ---------------------------------------------------------- */
  ticker: {
    /* Colors (use hex codes) */
    accentColor:      '#FFD700',  /* Gold — category badge & accents  */
    accentColorDark:  '#DAA520',  /* Darker gold — badge gradient end */
    bgColor:          '#0d0d0d',  /* Bar background                  */
    bgColorLight:     '#1a1a1a',  /* Bar background gradient start   */
    textColor:        '#FFFFFF',  /* Entry name text                  */
    detailColor:      '#AAAAAA',  /* Detail text (bits, $amount)      */
    separatorColor:   '#555555',  /* Dot separators between entries   */

    /* Sizing */
    barHeight:        56,         /* Ticker bar height in px          */
    fontSizeLabel:    16,         /* Category label font size         */
    fontSizeRank:     16,         /* Rank number font size            */
    fontSizeName:     17,         /* Entry name font size             */
    fontSizeDetail:   14,         /* Detail text font size            */

    /* Behavior */
    scrollSpeed:      90,         /* Pixels per second                */
    pauseBetweenMs:   2000,       /* Pause between categories (ms)    */
    maxEntries:       10,         /* Max entries per category         */
    showConnectionDot: true,      /* Green/red socket status dot      */
  },

  /* ----------------------------------------------------------
     EXTRA LIFE OVERLAY TIMING
     Controls the donation overlay + QR code cycle.
     ---------------------------------------------------------- */
  overlay: {
    overlayShowSec:   60,         /* Donation overlay duration (sec)  */
    qrPageShowSec:    60,         /* QR "Scan to Donate" page (sec)   */
    hideDurationMin:  5,          /* Hidden duration (minutes)        */
  },
};
