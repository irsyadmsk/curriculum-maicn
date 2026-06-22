// Firebase config — Curriculum OS · MA ICN
const firebaseConfig = {
  apiKey:            "AIzaSyBPw93pAKjmnDVISN3dcK2hLIqezd5nEkM",
  authDomain:        "curriculum-maicn.firebaseapp.com",
  projectId:         "curriculum-maicn",
  storageBucket:     "curriculum-maicn.firebasestorage.app",
  messagingSenderId: "724653150382",
  appId:             "1:724653150382:web:0418142bc6d4e47bc71d3f",
  measurementId:     "G-PFH503FJ6J"
};

// Inisialisasi Firebase (compat SDK — cocok untuk static HTML)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
window.db   = firebase.firestore();
window.auth = firebase.auth();
