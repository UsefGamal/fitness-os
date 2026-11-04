package com.usefgamal.fitnessos.health;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * What Health Connect shows when you ask why Fitness OS wants your data
 * (Android requires one). Plain text, no network.
 */
public class HealthPrivacyActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView t = new TextView(this);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        t.setPadding(pad, pad, pad, pad);
        t.setTextSize(17);
        t.setTextColor(Color.WHITE);
        t.setText(
            "Fitness OS and Health Connect\n\n"
                + "Fitness OS reads your weight so weigh-ins from a scale or another app show up in your progress, "
                + "and writes your finished workouts as exercise sessions.\n\n"
                + "Everything stays on this phone. Fitness OS has no server, no account, no analytics and no ads, "
                + "and it never sends your health data anywhere.\n\n"
                + "You can turn this off any time in Health Connect's settings or in Fitness OS > Settings.");
        ScrollView s = new ScrollView(this);
        s.setBackgroundColor(Color.BLACK);
        s.addView(t);
        setContentView(s);
    }
}
