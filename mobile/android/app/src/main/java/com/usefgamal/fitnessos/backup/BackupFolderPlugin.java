package com.usefgamal.fitnessos.backup;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * The automatic backup's folder (BAK-1). The person picks a folder once
 * with Android's own picker; the app keeps the grant and may then read and
 * write its own backup files there. No storage permission is asked for.
 *
 * Rules kept here as well as in lib/autoBackup.js:
 * - Only names matching OURS are ever written, renamed or deleted. Any
 *   other file in the folder is the person's and is never touched.
 * - The grant (a content:// address) lives in this plugin's own
 *   SharedPreferences, never in the data file, and is left out of Android's
 *   backup (res/xml rules): a grant means nothing on another phone.
 * - For a folder that syncs off the phone the backups are encrypted in JS
 *   (lib/backupCrypto.js). Its data key is kept here, wrapped by an AES key
 *   in the Android Keystore that never leaves the phone's secure hardware.
 *   The same prefs file holds the wrapped key and the recovery header.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {
    static final String PREFS = "fitness-os-backup-folder";
    private static final String KEY_URI = "tree";
    private static final Pattern OURS = Pattern.compile("^fitness-os-backup-\\d{4}-\\d{2}-\\d{2}\\.json(\\.enc)?(\\.tmp)?$");
    private static final String LOCAL = "com.android.externalstorage.documents";
    private static final int RW = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
    /** A backup is a few MB at most; refuse to read anything far bigger. */
    private static final int MAX_READ = 12 * 1024 * 1024;

    private static final String KEY_WRAPPED = "data_key";
    private static final String KEY_META = "data_key_meta";
    private static final String ALIAS = "fitness-os-backup-key";

    private static SecretKey keystoreKey(boolean create) throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            if (!create) return null;
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
            kg.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    private Uri tree() {
        String saved = prefs().getString(KEY_URI, null);
        return saved == null ? null : Uri.parse(saved);
    }

    private boolean granted(Uri tree) {
        if (tree == null) return false;
        for (UriPermission p : resolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isReadPermission() && p.isWritePermission()) return true;
        }
        return false;
    }

    private Uri folderDoc(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    /** The folder's own name, or null when it can no longer be read. */
    private String folderName(Uri tree) {
        try (Cursor c = resolver().query(folderDoc(tree), new String[] { Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** The document for one of the folder's files, or null. */
    private Uri find(Uri tree, String name) {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor c = resolver().query(children, new String[] { Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            while (c != null && c.moveToNext()) {
                if (name.equals(c.getString(1))) return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private JSObject describe(Uri tree) {
        JSObject out = new JSObject();
        String name = granted(tree) ? folderName(tree) : null;
        out.put("granted", name != null);
        out.put("name", name);
        out.put("synced", tree != null && !LOCAL.equals(tree.getAuthority()));
        return out;
    }

    /** The granted folder, or null after rejecting the call. */
    private Uri folderOrReject(PluginCall call) {
        Uri tree = tree();
        if (!granted(tree) || folderName(tree) == null) {
            call.reject("folder_gone", "folder_gone");
            return null;
        }
        return tree;
    }

    /** One of our own file names, or null after rejecting the call. */
    private String oursOrReject(PluginCall call, String key) {
        String name = call.getString(key);
        if (name == null || !OURS.matcher(name).matches()) {
            call.reject("not_ours", "not_ours");
            return null;
        }
        return name;
    }

    private static boolean noSpace(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String m = t.getMessage();
            if (m != null && (m.contains("ENOSPC") || m.toLowerCase().contains("no space"))) return true;
        }
        return false;
    }

    /** Open Android's folder picker: { granted, name, synced }. */
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(RW | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try {
            startActivityForResult(call, intent, "picked");
        } catch (Exception e) {
            call.reject("folder_gone", "folder_gone");
        }
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri picked = result.getResultCode() == Activity.RESULT_OK && data != null ? data.getData() : null;
        if (picked == null) {
            JSObject out = describe(tree());
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        try {
            resolver().takePersistableUriPermission(picked, RW);
        } catch (Exception e) {
            call.reject("folder_gone", "folder_gone");
            return;
        }
        Uri old = tree();
        if (old != null && !old.equals(picked)) {
            try {
                resolver().releasePersistableUriPermission(old, RW);
            } catch (Exception ignored) {
                // Already gone.
            }
        }
        prefs().edit().putString(KEY_URI, picked.toString()).apply();
        JSObject out = describe(picked);
        out.put("cancelled", false);
        call.resolve(out);
    }

    /** { granted, name, synced }; granted is false when the folder was
     * removed or the permission taken away. */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(describe(tree()));
    }

    /** { files: [{ name, size, modified }] } for everything in the folder. */
    @PluginMethod
    public void list(PluginCall call) {
        Uri tree = folderOrReject(call);
        if (tree == null) return;
        JSArray files = new JSArray();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        String[] cols = { Document.COLUMN_DISPLAY_NAME, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED, Document.COLUMN_MIME_TYPE };
        try (Cursor c = resolver().query(children, cols, null, null, null)) {
            while (c != null && c.moveToNext()) {
                if (Document.MIME_TYPE_DIR.equals(c.getString(3))) continue;
                JSObject f = new JSObject();
                f.put("name", c.getString(0));
                f.put("size", c.isNull(1) ? 0 : c.getLong(1));
                f.put("modified", c.isNull(2) ? 0 : c.getLong(2));
                files.put(f);
            }
        } catch (Exception e) {
            call.reject("folder_gone", "folder_gone");
            return;
        }
        JSObject out = new JSObject();
        out.put("files", files);
        call.resolve(out);
    }

    /** Write (replace) one of our files: { name, text }. */
    @PluginMethod
    public void write(PluginCall call) {
        Uri tree = folderOrReject(call);
        if (tree == null) return;
        String name = oursOrReject(call, "name");
        if (name == null) return;
        String text = call.getString("text");
        if (text == null) {
            call.reject("write_failed", "write_failed");
            return;
        }
        Uri doc = null;
        try {
            Uri old = find(tree, name);
            if (old != null) DocumentsContract.deleteDocument(resolver(), old);
            // octet-stream, so no provider adds an extension of its own.
            doc = DocumentsContract.createDocument(resolver(), folderDoc(tree), "application/octet-stream", name);
            if (doc == null) throw new java.io.IOException("create");
            try (OutputStream out = resolver().openOutputStream(doc, "wt")) {
                if (out == null) throw new java.io.IOException("open");
                out.write(text.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
            // A provider may have changed the name (a copy "(1)"); that is
            // not the file the app asked for.
            if (find(tree, name) == null) throw new java.io.IOException("name");
            call.resolve();
        } catch (Exception e) {
            if (doc != null) {
                try {
                    DocumentsContract.deleteDocument(resolver(), doc);
                } catch (Exception ignored) {
                    // Nothing more to do.
                }
            }
            String code = noSpace(e) ? "no_space" : "write_failed";
            call.reject(code, code);
        }
    }

    /** { text } of one of our files. */
    @PluginMethod
    public void read(PluginCall call) {
        Uri tree = folderOrReject(call);
        if (tree == null) return;
        String name = oursOrReject(call, "name");
        if (name == null) return;
        Uri doc = find(tree, name);
        if (doc == null) {
            call.reject("write_failed", "write_failed");
            return;
        }
        try (InputStream in = resolver().openInputStream(doc)) {
            if (in == null) throw new java.io.IOException("open");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > MAX_READ) throw new java.io.IOException("too big");
            }
            JSObject out = new JSObject();
            out.put("text", new String(buf.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("write_failed", "write_failed");
        }
    }

    /** Give a checked .tmp its real name, replacing an older file of that
     * name: { from, to }. */
    @PluginMethod
    public void rename(PluginCall call) {
        Uri tree = folderOrReject(call);
        if (tree == null) return;
        String from = oursOrReject(call, "from");
        if (from == null) return;
        String to = oursOrReject(call, "to");
        if (to == null) return;
        Uri src = find(tree, from);
        if (src == null) {
            call.reject("write_failed", "write_failed");
            return;
        }
        try {
            Uri old = find(tree, to);
            if (old != null) DocumentsContract.deleteDocument(resolver(), old);
            Uri moved = null;
            try {
                moved = DocumentsContract.renameDocument(resolver(), src, to);
            } catch (Exception e) {
                moved = null;
            }
            if (moved == null || find(tree, to) == null) {
                // A provider without rename: copy the bytes to the real name.
                Uri source = find(tree, from);
                if (source == null) throw new java.io.IOException("lost");
                Uri dest = DocumentsContract.createDocument(resolver(), folderDoc(tree), "application/octet-stream", to);
                if (dest == null) throw new java.io.IOException("create");
                try (InputStream in = resolver().openInputStream(source); OutputStream out = resolver().openOutputStream(dest, "wt")) {
                    if (in == null || out == null) throw new java.io.IOException("open");
                    byte[] chunk = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(chunk)) > 0) out.write(chunk, 0, n);
                    out.flush();
                }
                DocumentsContract.deleteDocument(resolver(), source);
                if (find(tree, to) == null) throw new java.io.IOException("name");
            }
            call.resolve();
        } catch (Exception e) {
            String code = noSpace(e) ? "no_space" : "write_failed";
            call.reject(code, code);
        }
    }

    /** Delete one of our files: { name }. Any other name is refused. */
    @PluginMethod
    public void remove(PluginCall call) {
        Uri tree = folderOrReject(call);
        if (tree == null) return;
        String name = oursOrReject(call, "name");
        if (name == null) return;
        try {
            Uri doc = find(tree, name);
            if (doc != null) DocumentsContract.deleteDocument(resolver(), doc);
            call.resolve();
        } catch (Exception e) {
            call.reject("write_failed", "write_failed");
        }
    }

    /** Keep the backup data key: { key (base64, 32 bytes), meta (the key id
     * and recovery header, as JSON text) }. The key is stored only wrapped
     * by the Keystore. */
    @PluginMethod
    public void storeKey(PluginCall call) {
        String key = call.getString("key");
        String meta = call.getString("meta");
        if (key == null || meta == null) {
            call.reject("no_key", "no_key");
            return;
        }
        try {
            byte[] raw = Base64.decode(key, Base64.NO_WRAP);
            if (raw.length != 32) throw new IllegalArgumentException("size");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, keystoreKey(true));
            byte[] iv = c.getIV();
            byte[] ct = c.doFinal(raw);
            String wrapped = Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
            // commit, not apply: the key must be on disk before the first encrypted backup.
            if (!prefs().edit().putString(KEY_WRAPPED, wrapped).putString(KEY_META, meta).commit()) throw new java.io.IOException("prefs");
            call.resolve();
        } catch (Exception e) {
            call.reject("no_key", "no_key");
        }
    }

    /** { key, meta }: the data key unwrapped by the Keystore, or both null
     * when there is none or the Keystore key is gone (a reset or new phone). */
    @PluginMethod
    public void loadKey(PluginCall call) {
        JSObject out = new JSObject();
        out.put("key", null);
        out.put("meta", null);
        String wrapped = prefs().getString(KEY_WRAPPED, null);
        String meta = prefs().getString(KEY_META, null);
        if (wrapped == null || meta == null) {
            call.resolve(out);
            return;
        }
        try {
            String[] parts = wrapped.split(":", 2);
            SecretKey k = keystoreKey(false);
            if (k == null || parts.length != 2) throw new IllegalStateException("gone");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            byte[] raw = c.doFinal(Base64.decode(parts[1], Base64.NO_WRAP));
            out.put("key", Base64.encodeToString(raw, Base64.NO_WRAP));
            out.put("meta", meta);
        } catch (Exception e) {
            // The wrapped key can't be opened here: the passphrase is needed.
        }
        call.resolve(out);
    }

    /** Forget the data key (turning backup off). The Keystore key goes too. */
    @PluginMethod
    public void forgetKey(PluginCall call) {
        prefs().edit().remove(KEY_WRAPPED).remove(KEY_META).apply();
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        } catch (Exception ignored) {
            // Nothing more to do.
        }
        call.resolve();
    }

    /** Give the grant back and forget the folder. Files stay where they are. */
    @PluginMethod
    public void forget(PluginCall call) {
        Uri tree = tree();
        if (tree != null) {
            try {
                resolver().releasePersistableUriPermission(tree, RW);
            } catch (Exception ignored) {
                // Already gone.
            }
        }
        prefs().edit().remove(KEY_URI).apply();
        call.resolve();
    }
}
