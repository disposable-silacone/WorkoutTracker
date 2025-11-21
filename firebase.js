// This module is optional. If ./firebase-config.js is not present, syncing stays off.
// To enable: copy firebase-config.sample.js to firebase-config.js and fill in your project's config.

let firebaseService = null;

async function initFirebase() {
	try {
		// Attempt to load user-provided config dynamically
		let configModule = null;
		try {
			configModule = await import('./firebase-config.js');
		} catch (e) {
			// no config file present
			return null;
		}
		const firebaseConfig = (configModule && (configModule.default || configModule.firebaseConfig)) || null;
		if (!firebaseConfig) return null;

		// Import Firebase SDK (modular)
		const [{ initializeApp }, { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }, {
			getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy
		}] = await Promise.all([
			import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
			import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
			import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
		]);

		const app = initializeApp(firebaseConfig);
		const auth = getAuth(app);
		const db = getFirestore(app);
		try { await enableIndexedDbPersistence(db); } catch {}

		let unsubscribe = null;

		function subscribeEntries(callback, uid) {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
			if (!uid) {
				callback([]);
				return;
			}
			const q = query(collection(db, 'users', uid, 'workouts'), orderBy('createdAt', 'desc'));
			unsubscribe = onSnapshot(q, (snap) => {
				const items = [];
				snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
				callback(items);
			});
		}

		const provider = new GoogleAuthProvider();

		firebaseService = {
			signIn: () => signInWithPopup(auth, provider),
			signOut: () => signOut(auth),
			onAuthStateChanged: (cb) => onAuthStateChanged(auth, (user) => cb(user || null)),
			subscribeEntries: (cb) => {
				const uid = auth.currentUser?.uid;
				subscribeEntries(cb, uid);
			},
			upsertEntry: async (entry) => {
				const uid = auth.currentUser?.uid;
				if (!uid) return;
				const ref = doc(db, 'users', uid, 'workouts', entry.id);
				await setDoc(ref, entry, { merge: true });
			},
			deleteEntry: async (id) => {
				const uid = auth.currentUser?.uid;
				if (!uid) return;
				const ref = doc(db, 'users', uid, 'workouts', id);
				await deleteDoc(ref);
			}
		};

		return firebaseService;
	} catch (e) {
		console.error('Firebase init failed', e);
		return null;
	}
}

// Initialize on load and attach to window
initFirebase().then((svc) => {
	if (svc) window.firebaseService = svc;
});

export {};


