const client_id = '6723092b646a43249656366daa557f67'; // Your client ID
const client_secret = window.PERFORMANCE_CONFIG.spotifyClientSecret; // Your client secret

// Add event listener inside the module
document.getElementById('songTitle').addEventListener('change', searchSong);

// Function to get Spotify access token
async function getAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(client_id + ':' + client_secret),
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// Function to search for a song
async function searchSong(songTitle, artistName) {
  const token = await getAccessToken();
  const input = document.getElementById('songTitle').value;

  // Split by comma and trim whitespace
  [songTitle, artistName] = input.split(',').map((part) => part.trim());
  const query = encodeURIComponent(`${songTitle} ${artistName}`);

  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  displayResult(data);
}

// async function searchSong() {
//     const songTitle = document.getElementById('songTitle').value;
//     const token = await getAccessToken();

//     const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(songTitle)}&type=track&limit=10`, {
//         method: 'GET',
//         headers: {
//             'Authorization': 'Bearer ' + token
//         }
//     });

//     const data = await response.json();
//     displayResult(data);
// }

// Function to update the Spotify link in Firebase
async function updateSpotifyLinkInFirebase(spotifyLink) {
  // Prepare the data for Firebase
  var firebaseData = {
    link: spotifyLink,
  };

  try {
    // Send data to Firebase
    const firebaseResponse = await fetch(
      'https://magicdatabasekvk-default-rtdb.firebaseio.com/spotify.json',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(firebaseData),
      },
    );

    if (firebaseResponse.ok) {
      console.log('Data sent to Firebase successfully.');
    } else {
      console.error(
        'Error sending data to Firebase: ' + firebaseResponse.status,
      );
    }
  } catch (firebaseError) {
    console.error('Firebase error: ' + firebaseError);
  }
}

// Modified displayResult function to wait for Firebase update before redirecting
async function displayResult(data) {
  const resultElement = document.getElementById('result');

  if (data.tracks.items.length > 0) {
    const mostPopularSong = data.tracks.items.reduce((prev, current) =>
      prev.popularity > current.popularity ? prev : current,
    );
    const songName = mostPopularSong.name;
    const artistName = mostPopularSong.artists[0].name;
    const spotifyLink = mostPopularSong.external_urls.spotify;

    // Update the Spotify link in Firebase and wait for completion
    await updateSpotifyLinkInFirebase(spotifyLink);

    // Update UI
    resultElement.innerHTML = `Most popular song: <b>${songName}</b> by <b>${artistName}</b><br>
                                   <a href="${spotifyLink}" target="_blank">Listen on Spotify</a>`;

    // Redirect to Google or any other URL after Firebase update is complete
    window.location.replace('https://www.google.com/?client=safari');
  } else {
    resultElement.innerHTML = 'No songs found with that title.';
  }
}
