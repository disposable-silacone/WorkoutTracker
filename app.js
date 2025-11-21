(() => {
	const STORAGE_KEY = 'workouts_v1';

	// Elements
	const form = document.getElementById('workout-form');
	const dateEl = document.getElementById('date');
	const distanceEl = document.getElementById('distance');
	const paceMinEl = document.getElementById('paceMin');
	const paceSecEl = document.getElementById('paceSec');
	const painStartEl = document.getElementById('painStart');
	const painLevelEl = document.getElementById('painLevel');
	const painLevelValueEl = document.getElementById('painLevelValue');
	const stretchedEl = document.getElementById('stretched');
	const exercisedEl = document.getElementById('exercised');
	const notesEl = document.getElementById('notes');
	const clearBtn = document.getElementById('clearForm');
	const todayBtn = document.getElementById('todayBtn');
	const yesterdayBtn = document.getElementById('yesterdayBtn');
	const dataNote = document.getElementById('dataNote');

	// Auth controls (optional, only if firebase is configured)
	const signInBtn = document.getElementById('signInBtn');
	const signOutBtn = document.getElementById('signOutBtn');
	const userLabel = document.getElementById('userLabel');

	const entriesEl = document.getElementById('entries');
	const emptyStateEl = document.getElementById('emptyState');
	const exportBtn = document.getElementById('exportBtn');
	const importFile = document.getElementById('importFile');

	let editingId = null;
	let useCloud = false;
	let cloudItems = [];
	let toastTimer = null;

	function showToast(message) {
		const el = document.getElementById('toast');
		if (!el) return;
		el.textContent = message;
		el.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			el.classList.remove('show');
		}, 2500);
	}

	function friendlyAuthError(err) {
		const code = err && (err.code || err.message || '');
		if (typeof code === 'string') {
			if (code.includes('auth/unauthorized-domain')) return 'Auth domain not authorized. Add your GitHub Pages domain in Firebase → Authentication → Settings.';
			if (code.includes('auth/popup-blocked')) return 'Popup blocked. Allow popups for this site and try again.';
			if (code.includes('auth/popup-closed-by-user')) return 'Sign-in canceled.';
			if (code.includes('auth/cancelled-popup-request')) return 'Another sign-in is in progress.';
			if (code.includes('auth/operation-not-allowed')) return 'Google sign-in is not enabled. Enable Google provider in Firebase → Authentication → Sign-in method.';
			if (code.includes('auth/cookie-not-supported')) return 'Browser cookies are disabled or blocked. Enable cookies for this site.';
			if (code.includes('network')) return 'Network error. Check your connection and try again.';
		}
		return `Sign-in failed. ${code || ''}`.trim();
	}

	function formatDateToInput(date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function parsePaceToParts(paceStr) {
		if (!paceStr) return { min: '', sec: '' };
		const m = paceStr.match(/^(\d+):(\d{1,2})/);
		if (!m) return { min: '', sec: '' };
		return { min: m[1], sec: m[2] };
	}

	function readStore() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed;
		} catch {
			return [];
		}
	}

	function writeStore(items) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	}

	function upsertEntry(entry) {
		if (useCloud && window.firebaseService?.upsertEntry) {
			window.firebaseService.upsertEntry(entry);
		} else {
			const items = readStore();
			const idx = items.findIndex(it => it.id === entry.id);
			if (idx >= 0) {
				items[idx] = entry;
			} else {
				items.push(entry);
			}
			writeStore(items);
		}
	}

	function deleteEntry(id) {
		if (useCloud && window.firebaseService?.deleteEntry) {
			window.firebaseService.deleteEntry(id);
		} else {
			const items = readStore().filter(it => it.id !== id);
			writeStore(items);
		}
	}

	function render() {
		const base = useCloud ? cloudItems : readStore();
		const items = base.slice().sort((a, b) => b.createdAt - a.createdAt);
		entriesEl.innerHTML = '';
		if (items.length === 0) {
			emptyStateEl.style.display = 'block';
			return;
		}
		emptyStateEl.style.display = 'none';
		for (const item of items) {
			const li = document.createElement('li');
			li.className = 'entry';
			const header = document.createElement('div');
			header.className = 'entry-header';
			const title = document.createElement('div');
			title.className = 'entry-title';
			const date = new Date(item.date);
			const dateLabel = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
			title.textContent = `${dateLabel} • ${Number(item.distance).toFixed(2)} mi`;
			const actions = document.createElement('div');
			actions.className = 'entry-actions';
			const editBtn = document.createElement('button');
			editBtn.className = 'btn small';
			editBtn.textContent = 'Edit';
			editBtn.addEventListener('click', () => loadIntoForm(item.id));
			const delBtn = document.createElement('button');
			delBtn.className = 'btn small danger';
			delBtn.textContent = 'Delete';
			delBtn.addEventListener('click', () => {
				if (confirm('Delete this entry?')) {
					deleteEntry(item.id);
					if (editingId === item.id) {
						resetForm();
					}
					render();
				}
			});
			actions.appendChild(editBtn);
			actions.appendChild(delBtn);
			header.appendChild(title);
			header.appendChild(actions);

			const meta = document.createElement('div');
			meta.className = 'entry-meta';
			const bits = [];
			if (item.pace && item.pace.trim()) bits.push(`Pace ${item.pace}`);
			if (typeof item.painStart === 'number' && !Number.isNaN(item.painStart)) bits.push(`Pain start ${item.painStart.toFixed(2)} mi`);
			bits.push(`Pain level ${item.painLevel}`);
			bits.push(item.stretched ? 'Stretched ✓' : 'Stretched ✗');
			bits.push(item.exercised ? 'Exercised ✓' : 'Exercised ✗');
			meta.textContent = bits.join(' • ');

			const notes = document.createElement('div');
			notes.className = 'entry-notes';
			notes.textContent = item.notes || '';

			li.appendChild(header);
			li.appendChild(meta);
			if (item.notes && item.notes.trim()) {
				li.appendChild(notes);
			}
			entriesEl.appendChild(li);
		}
	}

	function resetForm() {
		form.reset();
		dateEl.value = formatDateToInput(new Date());
		painLevelEl.value = '0';
		painLevelValueEl.textContent = '0';
		editingId = null;
	}

	function loadIntoForm(id) {
		const items = readStore();
		const existing = items.find(it => it.id === id);
		if (!existing) return;
		editingId = id;
		dateEl.value = existing.date;
		distanceEl.value = existing.distance ?? '';
		const parts = parsePaceToParts(existing.pace ?? '');
		paceMinEl.value = parts.min;
		paceSecEl.value = parts.sec;
		painStartEl.value = existing.painStart ?? '';
		painLevelEl.value = String(existing.painLevel ?? '0');
		painLevelValueEl.textContent = String(existing.painLevel ?? '0');
		stretchedEl.checked = !!existing.stretched;
		exercisedEl.checked = !!existing.exercised;
		notesEl.value = existing.notes ?? '';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function download(filename, content, type = 'application/json') {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Init defaults
	dateEl.value = formatDateToInput(new Date());
	painLevelValueEl.textContent = painLevelEl.value;

	// Events
	painLevelEl.addEventListener('input', () => {
		painLevelValueEl.textContent = painLevelEl.value;
	});

	document.querySelectorAll('.pain-chip').forEach((btn) => {
		btn.addEventListener('click', () => {
			const v = btn.getAttribute('data-level');
			if (v == null) return;
			painLevelEl.value = v;
			painLevelValueEl.textContent = v;
		});
	});

	todayBtn.addEventListener('click', () => {
		dateEl.value = formatDateToInput(new Date());
	});
	yesterdayBtn.addEventListener('click', () => {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		dateEl.value = formatDateToInput(d);
	});

	clearBtn.addEventListener('click', () => {
		resetForm();
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const date = dateEl.value;
		const distance = parseFloat(String(distanceEl.value).replace(',', '.'));
		if (!date || Number.isNaN(distance)) {
			alert('Please enter a date and distance.');
			return;
		}
		const pMin = paceMinEl.value === '' ? null : parseInt(paceMinEl.value, 10);
		const pSec = paceSecEl.value === '' ? null : parseInt(paceSecEl.value, 10);
		let pace = '';
		if (pMin != null || pSec != null) {
			const mm = Math.max(0, pMin ?? 0);
			const ss = Math.max(0, Math.min(59, pSec ?? 0));
			pace = `${mm}:${String(ss).padStart(2, '0')}/mi`;
		}
		const painStartRaw = painStartEl.value;
		const painStart = painStartRaw === '' ? null : parseFloat(String(painStartRaw).replace(',', '.'));
		const entry = {
			id: editingId ?? `w_${Date.now()}`,
			createdAt: editingId ? (useCloud ? (cloudItems.find(it => it.id === editingId)?.createdAt ?? Date.now()) : readStore().find(it => it.id === editingId)?.createdAt ?? Date.now()) : Date.now(),
			date,
			distance,
			pace,
			painStart: painStart === null || Number.isNaN(painStart) ? null : painStart,
			painLevel: parseInt(painLevelEl.value, 10) || 0,
			stretched: !!stretchedEl.checked,
			exercised: !!exercisedEl.checked,
			notes: notesEl.value.trim()
		};
		upsertEntry(entry);
		resetForm();
		render();
	});

	exportBtn.addEventListener('click', () => {
		const items = useCloud ? cloudItems : readStore();
		const stamp = new Date().toISOString().slice(0, 10);
		download(`workouts_${stamp}.json`, JSON.stringify(items, null, 2));
	});

	importFile.addEventListener('change', async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			if (!Array.isArray(data)) {
				alert('Invalid file content.');
				return;
			}
			if (useCloud && window.firebaseService?.upsertEntry) {
				for (const item of data) {
					if (!item || typeof item !== 'object' || !item.id) continue;
					window.firebaseService.upsertEntry(item);
				}
			} else {
				// Simple merge on id
				const existing = readStore();
				const byId = new Map(existing.map(x => [x.id, x]));
				for (const item of data) {
					if (!item || typeof item !== 'object' || !item.id) continue;
					byId.set(item.id, item);
				}
				writeStore(Array.from(byId.values()));
			}
			render();
			alert('Import complete.');
		} catch (err) {
			console.error(err);
			alert('Failed to import file.');
		} finally {
			importFile.value = '';
		}
	});

	// Initial render
	render();

	// Optional Firebase auth/sync
	function bindFirebaseAuth() {
		const svc = window.firebaseService;
		if (!svc || !svc.onAuthStateChanged) return;
		svc.onAuthStateChanged(async (user) => {
			if (user) {
				useCloud = true;
				if (signInBtn) signInBtn.style.display = 'none';
				if (signOutBtn) signOutBtn.style.display = '';
				if (userLabel) {
					const label = user.email || user.displayName || 'Signed in';
					userLabel.textContent = `Signed in as ${label}`;
					userLabel.classList.remove('muted');
				}
				if (dataNote) dataNote.textContent = 'Data sync is ON (private to your account).';
				showToast('Signed in');

				svc.subscribeEntries((items) => {
					cloudItems = items || [];
					emptyStateEl.style.display = cloudItems.length ? 'none' : 'block';
					render();
				});

				const local = readStore();
				setTimeout(() => {
					if (local.length && (!cloudItems || cloudItems.length === 0)) {
						if (confirm('Upload your existing local entries to cloud?')) {
							for (const it of local) svc.upsertEntry(it);
						}
					}
				}, 500);
			} else {
				useCloud = false;
				if (signInBtn) signInBtn.style.display = '';
				if (signOutBtn) signOutBtn.style.display = 'none';
				if (userLabel) {
					userLabel.textContent = 'Not signed in';
					userLabel.classList.add('muted');
				}
				if (dataNote) dataNote.textContent = 'Data is saved on this device only.';
				showToast('Signed out');
				render();
			}
		});
	}

	// Always wire button clicks; they will no-op if firebase not ready yet
	signInBtn?.addEventListener('click', async () => {
		const svc = window.firebaseService;
		if (svc?.signIn) {
			try {
				signInBtn.classList.add('loading');
				signInBtn.disabled = true;
				const prev = signInBtn.textContent;
				signInBtn.textContent = 'Signing in…';
				await svc.signIn();
				// onAuthStateChanged will handle UI
				signInBtn.textContent = prev || 'Sign in';
			} catch (err) {
				console.error('Sign-in error', err);
				showToast(friendlyAuthError(err));
			} finally {
				signInBtn.classList.remove('loading');
				signInBtn.disabled = false;
			}
		} else {
			showToast('Sign-in is loading. Try again in a moment.');
		}
	});
	signOutBtn?.addEventListener('click', () => {
		if (!window.firebaseService?.signOut) return;
		signOutBtn.classList.add('loading');
		signOutBtn.disabled = true;
		window.firebaseService.signOut().catch(() => {}).finally(() => {
			signOutBtn.classList.remove('loading');
			signOutBtn.disabled = false;
		});
	});

	// Bind immediately if ready, or when firebase signals readiness
	if (window.firebaseService) bindFirebaseAuth();
	window.addEventListener('firebase-ready', bindFirebaseAuth);

	// Optional: register service worker when served over http(s)
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			if (location.protocol.startsWith('http')) {
				navigator.serviceWorker.register('service-worker.js').catch(() => {});
			}
		});
	}
})(); 


