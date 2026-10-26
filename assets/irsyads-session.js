// Generated locally from irsyads shared session sources; run node scripts/export-curriculum-session.mjs. No SDK client, credentials or provider migration.
var IrsyadsCurriculumSession = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    KeluarTertahan: () => KeluarTertahan,
    buatSesiTerpisah: () => buatSesiTerpisah,
    keluarTerikat: () => keluarTerikat,
    pesanGalatKeluar: () => pesanGalatKeluar
  });

  // packages/supabase/src/sesi.ts
  var POTONG = 3e3;
  var adaPeramban = () => typeof document !== "undefined";
  function domainInduk() {
    if (!adaPeramban()) return null;
    const host = location.hostname;
    if (host === "irsyads.com" || host.endsWith(".irsyads.com")) return ".irsyads.com";
    return null;
  }
  function bacaSemuaCookie() {
    const peta = /* @__PURE__ */ new Map();
    if (!adaPeramban() || !document.cookie) return peta;
    for (const bagian of document.cookie.split("; ")) {
      const pisah = bagian.indexOf("=");
      if (pisah < 0) continue;
      try {
        peta.set(bagian.slice(0, pisah), decodeURIComponent(bagian.slice(pisah + 1)));
      } catch {
      }
    }
    return peta;
  }
  function tulisCookie(nama, nilai, domain) {
    const aman = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${nama}=${encodeURIComponent(nilai)}; Domain=${domain}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax` + aman;
  }
  function hapusCookie(nama, domain) {
    document.cookie = `${nama}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax`;
  }
  function potonganMilik(kunci, semua) {
    const awalan = `${kunci}.`;
    return [...semua.keys()].filter((n) => n.startsWith(awalan)).map((n) => Number(n.slice(awalan.length))).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b);
  }
  var wadahLokal = {
    getItem: (k) => {
      try {
        return adaPeramban() ? localStorage.getItem(k) : null;
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        if (adaPeramban()) localStorage.setItem(k, v);
      } catch {
      }
    },
    removeItem: (k) => {
      try {
        if (adaPeramban()) localStorage.removeItem(k);
      } catch {
      }
    }
  };
  var bc = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("irsyads-sso-sync");
    }
  } catch {
  }
  function siarkanPerubahanSesi(jenis) {
    try {
      bc?.postMessage({ jenis, waktu: Date.now() });
    } catch {
    }
  }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function identitasToken(token) {
    try {
      if (typeof token !== "string" || token.length > 32e3) return null;
      const parts = token.split(".");
      if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof payload.sub !== "string" || typeof payload.session_id !== "string" || !UUID.test(payload.sub) || !UUID.test(payload.session_id)) return null;
      return { owner: payload.sub.toLowerCase(), session: payload.session_id.toLowerCase() };
    } catch {
      return null;
    }
  }
  function kunciPencabutan(kunci, id) {
    return /^[A-Za-z0-9_-]{1,180}$/.test(kunci) ? `${kunci}-revoked-${id.owner}-${id.session}` : null;
  }
  function sesiDicabut(kunci, nilai) {
    try {
      const record = JSON.parse(nilai);
      const id = identitasToken(record.access_token);
      if (!id || record.user?.id !== id.owner) return false;
      const marker = kunciPencabutan(kunci, id);
      if (!marker) return false;
      return (domainInduk() ? bacaSemuaCookie().get(marker) : wadahLokal.getItem(marker)) === "1";
    } catch {
      return false;
    }
  }
  function cabutSesiTerikat(kunci, owner, verifiedToken) {
    const id = identitasToken(verifiedToken);
    if (!adaPeramban() || !id || id.owner !== owner.toLowerCase()) return false;
    const marker = kunciPencabutan(kunci, id);
    if (!marker) return false;
    const domain = domainInduk();
    if (domain) tulisCookie(marker, "1", domain);
    else wadahLokal.setItem(marker, "1");
    const confirmed = (domain ? bacaSemuaCookie().get(marker) : wadahLokal.getItem(marker)) === "1";
    if (confirmed) siarkanPerubahanSesi("keluar");
    return confirmed;
  }
  var penyimpananSesi = {
    getItem(kunci) {
      const domain = domainInduk();
      if (!domain) {
        const value2 = wadahLokal.getItem(kunci);
        return value2 !== null && sesiDicabut(kunci, value2) ? null : value2;
      }
      const semua = bacaSemuaCookie();
      const utuh = semua.get(kunci);
      if (utuh !== void 0) return sesiDicabut(kunci, utuh) ? null : utuh;
      const nomor = potonganMilik(kunci, semua);
      if (nomor.length === 0) return null;
      if (nomor.some((n, i) => n !== i)) return null;
      const value = nomor.map((n) => semua.get(`${kunci}.${n}`) ?? "").join("");
      return sesiDicabut(kunci, value) ? null : value;
    },
    setItem(kunci, nilai) {
      if (sesiDicabut(kunci, nilai)) return;
      const domain = domainInduk();
      if (!domain) {
        wadahLokal.setItem(kunci, nilai);
        siarkanPerubahanSesi("masuk");
        return;
      }
      const lama = potonganMilik(kunci, bacaSemuaCookie());
      if (encodeURIComponent(nilai).length <= POTONG) {
        tulisCookie(kunci, nilai, domain);
        for (const n of lama) hapusCookie(`${kunci}.${n}`, domain);
        siarkanPerubahanSesi("masuk");
        return;
      }
      const potongan = [];
      let isi = "", ukuran = 0;
      for (const karakter of nilai) {
        const panjang = encodeURIComponent(karakter).length;
        if (ukuran + panjang > POTONG) {
          potongan.push(isi);
          isi = "";
          ukuran = 0;
        }
        isi += karakter;
        ukuran += panjang;
      }
      if (isi) potongan.push(isi);
      potongan.forEach((isi2, i) => tulisCookie(`${kunci}.${i}`, isi2, domain));
      for (const n of lama) if (n >= potongan.length) hapusCookie(`${kunci}.${n}`, domain);
      hapusCookie(kunci, domain);
      siarkanPerubahanSesi("masuk");
    },
    removeItem(kunci) {
      const domain = domainInduk();
      if (!domain) {
        wadahLokal.removeItem(kunci);
        siarkanPerubahanSesi("keluar");
        return;
      }
      hapusCookie(kunci, domain);
      for (const n of potonganMilik(kunci, bacaSemuaCookie())) hapusCookie(`${kunci}.${n}`, domain);
      wadahLokal.removeItem(kunci);
      siarkanPerubahanSesi("keluar");
    }
  };

  // packages/supabase/src/hasil-keluar.ts
  var messages = {
    "tidak-pasti": "Logout belum terkonfirmasi. Periksa koneksi dan sesi Anda sebelum mencoba lagi.",
    "sesi-berubah": "Sesi Anda berubah. Sesi yang lebih baru tetap masuk; periksa akun aktif sebelum melanjutkan.",
    "pembersihan": "Logout server selesai, tetapi pembersihan sesi lokal belum terkonfirmasi. Minta bantuan sebelum melanjutkan."
  };
  var KeluarTertahan = class extends Error {
    hasil;
    constructor(hasil) {
      super(messages[hasil]);
      this.name = "KeluarTertahan";
      this.hasil = hasil;
    }
  };
  function pesanGalatKeluar(error) {
    return error instanceof KeluarTertahan ? messages[error.hasil] : messages["tidak-pasti"];
  }

  // packages/supabase/src/keluar-terikat.ts
  async function keluarTerikat(config) {
    const base = new URL(config.url), deadline = config.deadlineMs ?? 15e3;
    const scope = config.scope ?? "local";
    if (!config.publicKey || !config.storageKey || !["local", "others"].includes(scope) || config.storage === void 0 !== (config.invalidateSession === void 0) || base.username || base.password || base.search || base.hash || base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) || !Number.isSafeInteger(deadline) || deadline < 1 || deadline > 6e4) throw Error("Invalid logout configuration");
    const read = () => {
      const raw = (config.storage ?? penyimpananSesi).getItem(config.storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value.access_token !== "string" || !value.access_token || typeof value.user?.id !== "string" || !value.user.id) throw Error("Session unavailable");
      return { token: value.access_token, owner: value.user.id };
    };
    const current = read();
    if (!current) return;
    if (config.expectedOwner && config.expectedOwner !== current.owner) throw new KeluarTertahan("sesi-berubah");
    if (config.expectedToken !== void 0 && config.expectedToken !== current.token) throw new KeluarTertahan("sesi-berubah");
    const controller = new AbortController();
    let timer;
    try {
      const cancelled = new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new KeluarTertahan("tidak-pasti")), { once: true });
      });
      timer = setTimeout(() => controller.abort(), deadline);
      const response = await Promise.race([cancelled, (config.fetch ?? fetch)(base.href.replace(/\/+$/, "") + "/auth/v1/logout?scope=" + scope, {
        method: "POST",
        headers: { apikey: config.publicKey, Authorization: "Bearer " + current.token },
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer"
      })]);
      if (!response.ok || controller.signal.aborted) throw new KeluarTertahan("tidak-pasti");
      if (scope === "local") {
        let invalidated = false;
        try {
          invalidated = config.invalidateSession ? config.invalidateSession(current.owner, current.token) : cabutSesiTerikat(config.storageKey, current.owner, current.token);
        } catch {
        }
        if (!invalidated) throw new KeluarTertahan("pembersihan");
      }
      let next;
      try {
        next = read();
      } catch {
        throw new KeluarTertahan("pembersihan");
      }
      if (next && (scope === "local" || next.owner !== current.owner || next.token !== current.token)) throw new KeluarTertahan("sesi-berubah");
    } catch (error) {
      throw error instanceof KeluarTertahan ? error : new KeluarTertahan("tidak-pasti");
    } finally {
      if (timer !== void 0) clearTimeout(timer);
    }
  }

  // packages/supabase/src/sesi-terpisah.ts
  function buatSesiTerpisah(base, key) {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(key)) throw Error("Invalid isolated session key");
    const marker = (owner, token) => {
      const id = identitasToken(token);
      return id && id.owner === owner ? `${key}-revoked-${id.owner}-${id.session}` : null;
    };
    const revoked = (value) => {
      try {
        const record = JSON.parse(value), name = marker(record.user?.id, record.access_token);
        return name !== null && base.getItem(name) === "1";
      } catch {
        return false;
      }
    };
    const storage = {
      getItem(k) {
        const value = base.getItem(k);
        return k === key && value !== null && revoked(value) ? null : value;
      },
      setItem(k, value) {
        if (k !== key || !revoked(value)) base.setItem(k, value);
      },
      removeItem(k) {
        base.removeItem(k);
      }
    };
    const invalidateSession = (owner, token) => {
      const name = marker(owner, token);
      if (!name) return false;
      base.setItem(name, "1");
      return base.getItem(name) === "1";
    };
    return { storage, invalidateSession };
  }
  return __toCommonJS(stdin_exports);
})();
