// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPw93pAKjmnDVISN3dcK2hLIqezd5nEkM",
  authDomain: "curriculum-maicn.firebaseapp.com",
  projectId: "curriculum-maicn",
  storageBucket: "curriculum-maicn.firebasestorage.app",
  messagingSenderId: "724653150382",
  appId: "1:724653150382:web:0418142bc6d4e47bc71d3f",
  measurementId: "G-PFH503FJ6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);