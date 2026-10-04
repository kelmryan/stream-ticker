/* Broadcaster config view: tells the broadcaster whether their channel is
   linked to a Stream Ticker account, and links them to sign up or to the
   dashboard where all ticker settings live. */
(function () {
  'use strict';

  function show(id) {
    ['loading', 'linked', 'unlinked', 'error'].forEach((s) => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  Twitch.ext.onAuthorized(async (auth) => {
    try {
      const res = await fetch(window.EBS_URL + '/ext/status', {
        headers: { Authorization: 'Bearer ' + auth.token },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const status = await res.json();

      if (status.linked) {
        document.getElementById('linked-name').textContent = status.display;
        document.getElementById('dashboard-link').href = status.dashboardUrl;
        show('linked');
      } else {
        document.getElementById('signup-link').href = status.signupUrl;
        show('unlinked');
      }
    } catch (e) {
      show('error');
    }
  });
})();
