export const LIBRARY_LIMITS = {saved:100,history:48,progress:1000};
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024;
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = value => (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const titleKey = item => `${item.kind}:${item.id}`;

// Keep only catalog metadata. Backup files never carry playback URLs or tokens.
export function normalizeTitle(value) {
  if (!record(value) || !['movie','tv'].includes(value.kind) || !positive(value.id) || typeof value.title !== 'string' || !value.title.trim()) return null;
  const item = {id:Number(value.id),kind:value.kind,title:value.title.trim().slice(0,300)};
  for (const field of ['poster','backdrop']) {
    if (typeof value[field] === 'string' && /^\/[\w./-]+$/.test(value[field])) item[field] = value[field].slice(0,500);
  }
  if (typeof value.overview === 'string') item.overview = value.overview.slice(0,2000);
  if (/^\d{4}$/.test(String(value.year))) item.year = String(value.year);
  if (finite(value.rating) && value.rating <= 10) item.rating = value.rating;
  if (finite(value.runtime)) item.runtime = Math.min(value.runtime,100000);
  for (const field of ['season','episode']) if (positive(value[field])) item[field] = Number(value[field]);
  for (const field of ['lastWatched','savedAt']) if (finite(value[field])) item[field] = value[field];
  return item;
}

export function normalizeTitles(value,limit=LIBRARY_LIMITS.saved) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(),items = [];
  for (const raw of value) {
    const item = normalizeTitle(raw);
    if (!item || seen.has(titleKey(item))) continue;
    seen.add(titleKey(item));items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

export function normalizeProgress(value) {
  if (!record(value)) return {};
  const entries = Object.entries(value).filter(([key,pos]) => /^(movie|tv):[1-9]\d*:[1-9]\d*:[1-9]\d*$/.test(key) && record(pos) && finite(pos.seconds) && finite(pos.duration) && finite(pos.updatedAt));
  entries.sort((a,b) => b[1].updatedAt-a[1].updatedAt);
  return Object.fromEntries(entries.slice(0,LIBRARY_LIMITS.progress).map(([key,pos]) => [key,{
    seconds:Math.floor(pos.duration > 0 ? Math.min(pos.seconds,pos.duration) : pos.seconds),
    duration:pos.duration,updatedAt:pos.updatedAt,
  }]));
}

export function normalizeLibrary(value) {
  return {
    saved:normalizeTitles(value?.saved),
    history:normalizeTitles(value?.history,LIBRARY_LIMITS.history),
    progress:normalizeProgress(value?.progress),
  };
}

export function mergeLibrary(current,incoming) {
  const existing = normalizeLibrary(current),added = normalizeLibrary(incoming);
  const progress = {...existing.progress};
  for (const [key,value] of Object.entries(added.progress)) {
    if (!progress[key] || value.updatedAt > progress[key].updatedAt) progress[key] = value;
  }
  return {
    saved:normalizeTitles([...existing.saved,...added.saved]),
    history:normalizeTitles([...existing.history,...added.history].sort((a,b) => (b.lastWatched||0)-(a.lastWatched||0)),LIBRARY_LIMITS.history),
    progress:normalizeProgress(progress),
  };
}

export function createLibraryBackup(library) {
  return {app:'cinera',version:1,exportedAt:new Date().toISOString(),...normalizeLibrary(library)};
}

export function parseLibraryBackup(text) {
  if (typeof text !== 'string' || text.length > BACKUP_MAX_BYTES) throw new Error('Choose a Cinera backup smaller than 2 MB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a Cinera backup.'); }
  if (!record(data) || data.app !== 'cinera' || data.version !== 1 || !Array.isArray(data.saved) || !Array.isArray(data.history) || !record(data.progress)) throw new Error('This is not a supported Cinera library backup.');
  if (data.saved.length > LIBRARY_LIMITS.saved || data.history.length > LIBRARY_LIMITS.history || Object.keys(data.progress).length > LIBRARY_LIMITS.progress) throw new Error('This backup exceeds the supported library size.');
  if ([...data.saved,...data.history].some(item => !normalizeTitle(item)) || Object.keys(normalizeProgress(data.progress)).length !== Object.keys(data.progress).length) throw new Error('This backup contains invalid titles or watch progress.');
  return normalizeLibrary(data);
}

export function resumePath(item) {
  const base = `/watch/${item.kind}/${item.id}`;
  return item.kind === 'tv' ? `${base}?season=${positive(item.season)?Number(item.season):1}&episode=${positive(item.episode)?Number(item.episode):1}` : base;
}

export function filterLibrary(items,{query='',kind='all',sort='recent'}={}) {
  const term = query.trim().toLocaleLowerCase();
  const result = items.filter(item => (kind === 'all' || item.kind === kind) && (!term || item.title.toLocaleLowerCase().includes(term)));
  if (sort === 'title') result.sort((a,b) => a.title.localeCompare(b.title));
  if (sort === 'rating') result.sort((a,b) => (b.rating||0)-(a.rating||0));
  if (sort === 'year') result.sort((a,b) => Number(b.year||0)-Number(a.year||0));
  return result;
}
