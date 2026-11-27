(() => {
  const messages = [
    { category: 'A Christmas greeting', text: 'May your days be merry, your nights be bright, and your home be full of the people you love.' },
    { category: 'A little Christmas wonder', text: 'The tradition of decorating evergreen trees stretches back centuries, a reminder of life through winter.' },
    { category: 'A thought for today', text: 'May your winter be gentle, and your home be full of light.' },
    { category: 'Around the winter world', text: 'In Iceland, the Yule Lads bring a little mischief and magic to the thirteen nights before Christmas.' },
    { category: 'A Christmas greeting', text: 'Wishing you a season of small joys, warm gatherings, and wonder in the ordinary.' },
    { category: 'A little Christmas wonder', text: 'In 1843, the first commercial Christmas card was commissioned in London.' },
    { category: 'A thought for today', text: 'Like snow in the moonlight, kindness makes even the quietest moments shine.' },
    { category: 'Around the winter world', text: 'In Japan, sharing a Christmas cake is a much-loved seasonal tradition.' },
    { category: 'A Christmas greeting', text: 'May you find a little magic in every candlelit window and every frosty morning.' },
    { category: 'A little Christmas wonder', text: 'The world’s tallest cut Christmas tree was a 67-metre Douglas fir in Seattle, in 1950.' },
    { category: 'A thought for today', text: 'Winter reminds us that rest is part of growing, and brighter days always return.' },
    { category: 'Around the winter world', text: 'In Sweden, Saint Lucia’s Day brings candlelight and song to the darkest days of December.' },
    { category: 'A Christmas greeting', text: 'May the season bring you the rarest gifts: time, laughter, and a little peace.' },
    { category: 'A little Christmas wonder', text: '“Jingle Bells” was first published in 1857 as “The One Horse Open Sleigh.”' },
    { category: 'Around the winter world', text: 'In Norway, a bowl of porridge may be left out for the barn spirit on Christmas Eve.' },
    { category: 'A thought for today', text: 'There is a kind of magic in slowing down enough to notice the snow.' }
  ];

  function dayNumber(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  function render() {
    const now = new Date();
    const index = (dayNumber(now) + now.getFullYear()) % messages.length;
    const message = messages[index];
    const category = document.getElementById('message-category');
    const text = document.getElementById('daily-message');
    const date = document.getElementById('message-date');
    if (category) category.textContent = message.category;
    if (text) text.textContent = message.text;
    if (date) date.textContent = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(now);
  }
  document.addEventListener('DOMContentLoaded', render, { once: true });
})();
