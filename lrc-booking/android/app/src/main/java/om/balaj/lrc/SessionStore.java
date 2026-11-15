package om.balaj.lrc;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

/** Identity handed over by the page. No service key is stored. */
public final class SessionStore {
    private static final String PREFS = "manhal_session";

    private final SharedPreferences prefs;

    public SessionStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void save(String supabaseUrl, String anonKey, String fileNo, String lang) {
        prefs.edit()
                .putString("supabase_url", supabaseUrl)
                .putString("anon_key", anonKey)
                .putString("file_no", fileNo)
                .putString("lang", lang)
                .apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }

    public String url() { return prefs.getString("supabase_url", ""); }
    public String anonKey() { return prefs.getString("anon_key", ""); }
    public String fileNo() { return prefs.getString("file_no", ""); }
    public String lang() { return prefs.getString("lang", "ar"); }

    public boolean hasIdentity() {
        return !url().isEmpty() && !anonKey().isEmpty() && !fileNo().isEmpty();
    }

    public Set<String> seenIds() {
        return new HashSet<>(prefs.getStringSet("seen_ids", new HashSet<>()));
    }

    public void remember(Set<String> ids) {
        prefs.edit().putStringSet("seen_ids", ids).apply();
    }
}
