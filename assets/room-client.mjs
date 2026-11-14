/** Klien RPC ruang guru/admin. Worker dan SQL tetap menjadi pemeriksa akses yang sebenarnya. */
const messages = {
  forbidden: 'Akun atau penugasan ini tidak memiliki izin.',
  room_disabled: 'Ruang ini menunggu aktivasi pengelola. Belum ada data yang disimpan.',
  stale_revision: 'Data berubah di server. Muat ulang sebelum menyimpan.',
  journal_incomplete: 'Kegiatan dan tindak lanjut wajib diisi.',
  note_window: 'Catatan hanya dapat diisi untuk hari ini sampai 14 hari ke belakang.',
  invalid_supervision: 'Data supervisi belum lengkap atau statusnya sudah berubah.',
  room_scope: 'Rentang tanggal terlalu lebar. Persempit maksimal satu tahun.',
  token_mismatch: 'Permintaan ganda dengan isi berbeda. Muat ulang sebelum mencoba lagi.'
};
export function roomClient(transport) {
  async function call(name, args) {
    const {data, error} = await transport(name, args);
    if (error) { const key = Object.keys(messages).find(k => String(error.message || error).includes(k)); throw Error(key ? messages[key] : 'Server belum dapat memastikan hasil. Periksa sebelum mencoba lagi.'); }
    return data;
  }
  function snapshot(data) { if (!data || data.version !== 1 || !Array.isArray(data.rows) || data.rows.length !== data.count) throw Error('Data belum terbaca lengkap dari server.'); return data; }
  function receipt(result, id, expected, token) { if (result?.id !== id || result.revision !== expected + 1 || result.token !== token) throw Error('Penyimpanan belum dapat dipastikan. Muat ulang untuk memeriksa.'); return result; }
  return {
    async notes(from, to) { return snapshot(await call('curriculum_teacher_note_read', {p_from: from, p_to: to})); },
    async noteSave(row, date, content, token) { return receipt(await call('curriculum_teacher_note_write', {p_id: row.id, p_expected: row.revision, p_date: date, p_content: content, p_token: token}), row.id, row.revision, token); },
    async supervisions(mode) { return snapshot(await call('curriculum_supervision_read', {p_mode: mode})); },
    async supervisionSave(row, action, data, token) { return receipt(await call('curriculum_supervision_write', {p_id: row.id, p_expected: row.revision, p_action: action, p_data: data, p_token: token}), row.id, row.revision, token); },
    summary: (from, to) => call('curriculum_room_summary', {p_from: from, p_to: to})
  };
}
export const browserRoomClient = () => roomClient(async (name, args) => {
  const response = await fetch('/api/room/rpc', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, args})});
  return response.json();
});
