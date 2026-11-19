// What changed, per released version, in the words a friend would use.
// Every release needs an entry for its version (the release build checks):
// one to six short lines on what a person will notice, newest version first.
// The version is the tag without the "v". lib/whatsNew.js decides which
// of these a phone still has to see.
export const WHATS_NEW = [
  {
    version: '1.1.12',
    items: [
      { icon: 'calendar', text: 'Home shows your week at a glance: days trained, the plan ahead, and work sets so far.' },
      { icon: 'chart', text: 'Stats > Body shows what you burn, measured from your own month of meals and weigh-ins, beside the app\'s estimate.' },
      { icon: 'check', text: 'Meals shows the last 7 days: how much you logged and the days protein hit 90%.' },
      { icon: 'lock', text: 'Stats lists what unlocks next, and Settings > Data has a data health check.' },
      { icon: 'trend', text: 'The widget shows your trend weight and its change this week, and watch data is kept for 400 days.' },
    ],
  },
  {
    version: '1.1.11',
    items: [
      { icon: 'chart', text: 'The weight chart shows your trend line over each weigh-in, with kg and dates, 4 weeks to All, and a table view.' },
      { icon: 'calendar', text: 'Stats > Body adds weekly averages, steadier than any one day.' },
      { icon: 'user', text: 'Muscles shows hard sets a week over your last 4 weeks against the 10-20 range.' },
      { icon: 'barbell', text: 'Overview adds training days for 12 weeks and, on a cut, whether your lifts held up.' },
    ],
  },
  {
    version: '1.1.10',
    items: [
      { icon: 'barbell', text: 'Stats > Strength opens on your last 4 weeks against the 4 before: lifts up, held or down, and the biggest movers.' },
      { icon: 'check', text: 'After a workout, each lift shows up, held or down against the last time you did that session.' },
      { icon: 'trophy', text: 'The full records list is still there, one tap away under All records.' },
    ],
  },
  {
    version: '1.1.9',
    items: [
      { icon: 'trend', text: 'The weight card shows your pace as a range measured from your weigh-ins, and when you would reach your goal at that pace.' },
      { icon: 'dumbbell', text: 'Today\'s workout card shows what you lifted last time in that session.' },
      { icon: 'check', text: 'In a workout, each set shows last time\'s set under it, and once you tick it, how it compares.' },
    ],
  },
  {
    version: '1.1.8',
    items: [
      { icon: 'calendar', text: 'Plan shows the day you picked as a tab, and the Start button follows it: "Start Push today".' },
      { icon: 'undo', text: 'Swap lets you pick any of the 16 muscle groups, and no longer offers an exercise already in that day.' },
    ],
  },
  {
    version: '1.1.7',
    items: [
      { icon: 'person', text: 'Rotator cuff and hip flexors are muscles of their own, under Shoulders and Quads in the Library.' },
      { icon: 'search', text: 'Each muscle splits its list into Training and Stretches, and stretches carry a Stretch label.' },
      { icon: 'trend', text: 'Stretches no longer count toward weekly sets or recovery on Stats.' },
    ],
  },
  {
    version: '1.1.6',
    items: [
      { icon: 'trophy', text: 'Planks and other timed holds no longer show a made-up one-rep max or count towards records and kg lifted.' },
      { icon: 'chart', text: 'Strength\'s "New in 30 days" counts only records that beat an earlier best, not first sessions.' },
      { icon: 'trend', text: 'Weight and strength charts space points by date, so a week without a weigh-in looks like a week.' },
      { icon: 'chart', text: 'Sessions on Stats counts training days, the same as your streak, and muscle chips say they are about your plan.' },
    ],
  },
  {
    version: '1.1.5',
    items: [
      { icon: 'dumbbell', text: 'A plank, wall sit or other hold swapped into your plan now logs seconds, not reps.' },
      { icon: 'sunrise', text: 'Ramadan dates: a first day after the last one (or the other way round) keeps Ramadan on and moves the other date.' },
      { icon: 'person', text: 'Profile saves Build muscle or Keep my weight without a goal weight or date, and flags a goal on the wrong side.' },
      { icon: 'gear', text: 'Quests and Shopping say Monday when your week starts on Monday, and the Meals buttons fit at the biggest text size.' },
    ],
  },
  {
    version: '1.1.4',
    items: [
      { icon: 'check', text: 'Bodyweight moves like squats, lunges and pike push-ups can be ticked off without typing a weight.' },
    ],
  },
  {
    version: '1.1.3',
    items: [
      { icon: 'home', text: 'The Tafra icon now shows on your home screen, instead of the default Android icon.' },
      { icon: 'home', text: 'A leaner Tafra mark on the icon, the intro and notifications, and the line "Your next leap." under the name.' },
      { icon: 'trend', text: 'The weight card on Home shows your latest weigh-in big, with the trend just under it.' },
      { icon: 'home', text: 'Adding the widget shows a preview of it, and the Other sessions tiles on Home lost their stray white edges.' },
    ],
  },
  {
    version: '1.1.2',
    items: [
      { icon: 'play', text: 'Pages slide like a phone app: the old page moves away as the new one comes in, and tabs switch faster.' },
      { icon: 'plus', text: 'Log padel or recovery, see a recipe and change equipment in a sheet, without leaving the page.' },
      { icon: 'gear', text: 'New in Settings > Look: Reduce motion. Toasts can be swiped away, and Undo shows how long it stays.' },
    ],
  },
  {
    version: '1.1.1',
    items: [
      { icon: 'person', text: 'A more lifelike muscle map: smooth muscles on one body, with hands, feet, six-pack lines and outer hips.' },
      { icon: 'dumbbell', text: '16 muscle groups in Library, Stats and recovery, now with obliques, trapezius, lower back and abductors.' },
      { icon: 'book', text: 'All with photos in the Library opens on a By muscle list, with a small map and an exercise count.' },
    ],
  },
  {
    version: '1.1.0',
    items: [
      { icon: 'home', text: 'The app is now called Tafra (طفرة, a leap), with a new icon. Your data stays as it was.' },
      { icon: 'play', text: 'Smoother motion: cards grow into their page, tabs glide and sheets follow your finger.' },
      { icon: 'chart', text: 'Colour follows progress: bars go green at target and a new record sparks.' },
    ],
  },
  {
    version: '1.0.9',
    items: [
      { icon: 'home', text: "Home is clearer: the card says Today's workout, the session name is bigger, and the pace sits in the advice line." },
      { icon: 'chart', text: 'Numbers line up in neat columns, headings wrap evenly, and a slow page shows grey boxes while it loads.' },
      { icon: 'meals', text: 'Small fixes: Stats tabs fit their words, History no longer says Padel twice, and Home counts up when you add water.' },
    ],
  },
  {
    version: '1.0.8',
    items: [
      { icon: 'gear', text: 'Settings are simpler: six groups, and a search at the top to find any setting.' },
      { icon: 'play', text: 'Training settings fold into four parts, with rest times picked from a list.' },
      { icon: 'download', text: 'Data & backups is grouped, and Export CSV lets you pick workouts, body or meals.' },
    ],
  },
  {
    version: '1.0.7',
    items: [
      { icon: 'timer', text: 'When a rest ends, "Log set & rest" on the notification logs the set it shows and starts your next rest, without opening the app.' },
    ],
  },
  {
    version: '1.0.6',
    items: [
      { icon: 'dumbbell', text: 'New workout screen: each set is a row. Tap the reps or kg to change them, tap the tick to log it.' },
      { icon: 'timer', text: 'The top of a workout shows the time, the kg lifted so far and about how many kcal.' },
      { icon: 'barbell', text: 'Every exercise in a workout has a small photo. Tap it to see the move.' },
    ],
  },
  {
    version: '1.0.5',
    items: [
      { icon: 'trend', text: 'Weight steady for 3 weeks on a cut? Home offers a small calorie adjustment. You choose, and Meals can undo it.' },
    ],
  },
  {
    version: '1.0.4',
    items: [
      { icon: 'trophy', text: 'Reached your goal? Home offers maintenance: calories go up a little each week, so the weight stays off.' },
    ],
  },
  {
    version: '1.0.3',
    items: [
      { icon: 'dumbbell', text: 'Gym mode (Settings, Training): no tab bar during a workout, Log set at the bottom, Back pauses.' },
    ],
  },
  {
    version: '1.0.2',
    items: [
      { icon: 'info', text: 'Help in Settings: ten quick answers, like how to update, back up or move a session.' },
      { icon: 'lock', text: 'Privacy page: where every copy of your data goes, and Delete everything to start over.' },
      { icon: 'trend', text: 'Fitness test on Stats: push-ups, squats and a plank hold, to see how you improve.' },
      { icon: 'barbell', text: 'A bodyweight move\'s page shows its easier and harder versions.' },
      { icon: 'check', text: 'Bigger text up to 130% (Settings, Look), and TalkBack now says each set, record, rest over and meal.' },
      { icon: 'star', text: 'New on the app? Home shows five first-week steps that tick themselves as you go.' },
    ],
  },
  {
    version: '1.0.1',
    items: [
      { icon: 'star', text: 'What\'s new now lists every change since the version you had before, even if you skipped a few updates.' },
      { icon: 'timer', text: 'Planks and other holds now count seconds, not weight and reps.' },
      { icon: 'bell', text: 'Warm-ups show in the notification: the move and its countdown, and warm-up weights before a barbell lift.' },
    ],
  },
  {
    version: '1.0.0',
    items: [
      { icon: 'moon', text: 'Light theme: Settings, Look and modules, Theme. Pick Dark, Light or Match phone.' },
      { icon: 'barbell', text: 'Tap a logged set\'s number to mark it a warm-up, a drop set or to failure. Warm-ups don\'t count as work sets.' },
      { icon: 'calendar', text: 'Your week can start on Sunday or Monday (Settings, Times). Training at different times? Tick "My training time varies".' },
      { icon: 'book', text: 'Better plan suggestions: every plan now trains each muscle at least twice a week.' },
      { icon: 'check', text: 'After 8 weeks on a plan, Plan offers a check-in: a better plan if one fits, then keep or swap each exercise.' },
      { icon: 'sunrise', text: 'Ramadan mode: late meals stop at 23:30, a meal after midnight counts for last night, and a note after Eid.' },
    ],
  },
  {
    version: '0.9.9',
    items: [
      { icon: 'bolt', text: 'Logging a set feels instant, even with years of history.' },
      { icon: 'waves', text: 'Settings, Training, Vibration: Off, Light or Strong.' },
      { icon: 'trophy', text: 'Sunday wrap-up on Home: your sessions, sets and meal days for the week, and you can share it as a picture.' },
      { icon: 'heart', text: 'Back after a break? A welcome back card and a lighter first session instead of a broken streak.' },
      { icon: 'timer', text: 'Missed your session time? Home asks "Still time today?": start now, move it to tomorrow or skip.' },
    ],
  },
  {
    version: '0.9.8',
    items: [
      { icon: 'barbell', text: 'Weight jumps fit the move: 1 kg for small moves, 2 kg for dumbbells, and never much more than a tenth of the load.' },
      { icon: 'person', text: 'Push-ups, planks and other bodyweight moves grow by reps, then point you to a harder version.' },
      { icon: 'user', text: 'Setup asks if your day is mostly sitting, on your feet or physical work, so your calories start closer to right.' },
      { icon: 'meals', text: 'Meal portions now fit your own calorie target (carbs and fat change, protein stays). A ticked meal keeps its numbers for good.' },
      { icon: 'check', text: 'Settings, About shows a Data check line. It reads the same before and after an update if your data is safe.' },
      { icon: 'download', text: 'Settings, About has Check for updates, Back up now and install help for Samsung, Xiaomi, Infinix and Tecno.' },
    ],
  },
  {
    version: '0.9.7',
    items: [
      { icon: 'bolt', text: 'Your streak now counts weeks, not days. A week is kept with all your sessions but one, so one missed day never breaks it.' },
      { icon: 'medal', text: 'Badges and quests fit your goal: weight-loss rewards only show when losing weight is your goal.' },
      { icon: 'drop', text: 'The water quest uses your own water goal.' },
      { icon: 'star', text: 'Points live on the Quests page. Don\'t want quests? Switch them off in Settings, Modules.' },
    ],
  },
  {
    version: '0.9.6',
    items: [
      { icon: 'home', text: 'Home is shorter: today\'s session, your weight and today\'s numbers. The week is on Plan.' },
      { icon: 'play', text: 'During a workout, Pause, Finish and Discard are in one menu, with a Finish button after the last exercise.' },
      { icon: 'download', text: 'The backup reminder is now one thin line.' },
      { icon: 'heart', text: 'A quick safety check: seven yes or no questions, so no target can hurt you. Only the limits are saved, not your answers.' },
      { icon: 'barbell', text: 'Gaining or building muscle? Home shows the lift that grew most, under your weight.' },
      { icon: 'star', text: 'After an update, this note tells you what changed. You can open it again in Settings.' },
    ],
  },
  {
    version: '0.9.5',
    items: [
      { icon: 'meals', text: 'Ate something else? Log it on the meal with its calories and protein. Your foods are remembered.' },
      { icon: 'person', text: 'The muscle map is more detailed: a bigger chest, smaller traps, and split biceps, triceps and back.' },
      { icon: 'chev', text: 'Swiping between the five tabs now follows your finger.' },
      { icon: 'chart', text: 'Stats shows each muscle group as Low, On track or High, and you tap a row to edit it.' },
      { icon: 'book', text: 'Library opens on search, and Profile shows your targets first.' },
    ],
  },
  {
    version: '0.9.4',
    items: [
      { icon: 'trophy', text: 'Finishing a workout ends on a short summary: time, sets, total lifted and new bests.' },
      { icon: 'scale', text: 'Log your weight in one tap from the weight card on Home.' },
      { icon: 'dumbbell', text: 'Exercises have levels, and you can swap one for another that trains the same muscles.' },
      { icon: 'cart', text: 'The shopping list follows the meal options you picked.' },
    ],
  },
];
