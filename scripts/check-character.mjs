import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const info = await c.evaluate(`(() => {
    const chars = Array.from(document.querySelectorAll('.character_select')).map(el => ({
      name: el.querySelector('.character_name')?.textContent,
      avatar: el.querySelector('img')?.src
    }));
    const currentCard = window.characters?.[window.this_chid]?.name;
    return {
      currentCard,
      charCount: chars.length,
      firstFew: chars.slice(0, 5)
    };
  })()`);
  console.log('Chat/Character Info:', JSON.stringify(info, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
