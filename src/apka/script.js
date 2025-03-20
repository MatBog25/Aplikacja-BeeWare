document.addEventListener('DOMContentLoaded', () => {
  const UPDATE_URL = '/update-data';
  const LOCAL_API_URL = '/data';
  let inMemoryCache = null;

  const cardsContainer = document.getElementById('cardsContainer');
  const loadingMsg = document.getElementById('loading');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  const closeBtn = document.getElementById('closeBtn');
  const themeToggle = document.getElementById('themeToggle');

  // Inicjalizacja motywu
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.classList.add(savedTheme);
  themeToggle.textContent = (savedTheme === 'light') ? 'Tryb ciemny' : 'Tryb jasny';
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('light') ? 'light' : 'dark';
    const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
    document.body.classList.replace(currentTheme, newTheme);
    themeToggle.textContent = (newTheme === 'light') ? 'Tryb ciemny' : 'Tryb jasny';
    localStorage.setItem('theme', newTheme);
  });

  function displayMatches(events, data) {
    cardsContainer.innerHTML = '';
    events.forEach((match, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${match.title || `Mecz #${index + 1}`}</div>
        <div class="score">${match.score || match.wynik || '?:?'}</div>
        <div class="date">${match.date || ''}</div>
      `;
      card.addEventListener('click', () => showDetails(match, data));
      cardsContainer.appendChild(card);
      setTimeout(() => card.classList.add('fade-in'), index * 80);
    });
  }

  function showDetails(match, data) {
    let html = `<h2>${match.title || 'Mecz bez nazwy'}</h2>`;
    const details = [];
    if (match.score || match.wynik) details.push(['Wynik', match.score || match.wynik]);
    if (match.date) details.push(['Data', match.date]);
    if (match.details) {
      if (match.details.league) details.push(['Liga', match.details.league]);
      if (match.details.stadium) details.push(['Stadion', match.details.stadium]);
      if (match.details.nested_object) {
        const nested = match.details.nested_object;
        if (nested.city) details.push(['Miasto', nested.city]);
        if (nested.time) details.push(['Godzina', nested.time]);
        if (nested.temperature) details.push(['Temperatura', nested.temperature]);
        if (nested.attendance) details.push(['Kibice', nested.attendance]);
      }
    }
    if (match.home_team) details.push(['Gospodarze', match.home_team]);
    if (match.away_team) details.push(['Goście', match.away_team]);
    if (match.odd1) {
      details.push(['Kurs (1)', match.odd1], ['Kurs (X)', match.oddX], ['Kurs (2)', match.odd2]);
    }
    if (details.length > 0) {
      html += `<table class="details-table">`;
      details.forEach(([label, value]) => {
        html += `<tr><th>${label}</th><td>${value}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p>Brak dostępnych szczegółów</p>`;
    }
    if (match.image) {
      html += `<hr/><img src="${match.image}" alt="Obrazek meczu" class="match-image">`;
    }
    if (match.video_link) {
      const videoUrl = match.video_link.replace('watch?v=', 'embed/');
      html += `
        <hr/><div class="video-container">
          <iframe src="${videoUrl}" 
                  allowfullscreen 
                  allow="accelerometer; autoplay; encrypted-media; gyroscope">
          </iframe>
        </div>`;
    }

    // Dodaj JSON do modalu
    const prettyJson = JSON.stringify(data, null, 2); // Formatuje JSON z wcięciami
    html += `<hr/><pre>${prettyJson}</pre>`;

    modalBody.innerHTML = html;
    modal.classList.add('show');
  }

  closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });

  // Pobranie danych z /update-data (online)
  function updateData() {
    return fetch(UPDATE_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Update error (status ${response.status})`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Data updated from API (with images in base64).");
        return data;
      });
  }

  // Odczyt z /data (offline)
  function loadCachedData() {
    return fetch(LOCAL_API_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Cache fetch error (status ${response.status})`);
        }
        return response.json();
      });
  }

  function loadData() {
    if (navigator.onLine) {
      updateData()
        .then(data => {
          displayMatches(data.events, data);
          console.log('Wszystko git!');
        })
        .catch(err => {
          console.error("Update failed:", err);
          loadCachedData()
            .then(data => {
              displayMatches(data.events, data);
              console.log('Wszystko git!');
            })
            .catch(err2 => {
              console.error("Error fetching cached data:", err2);
              if (loadingMsg) loadingMsg.textContent = 'Brak danych offline';
            });
        });
    } else {
      loadCachedData()
        .then(data => {
          displayMatches(data.events, data);
          console.log('Wszystko git!');
        })
        .catch(err => {
          console.error("Error fetching cached data:", err);
          if (loadingMsg) loadingMsg.textContent = 'Brak danych offline';
        });
    }
  }

  loadData();
});
