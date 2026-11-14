// What changed, per released version, in the words a friend would use.
// Every release needs an entry for its version (the release build checks):
// one to six short lines on what a person will notice, newest version first.
// The version is the tag without the "v". lib/whatsNew.js decides which
// of these a phone still has to see.
export const WHATS_NEW = [
  {
    version: '1.0.1',
    items: [
      { icon: 'star', text: 'What\'s new now lists every change since the version you had before, even if you skipped a few updates.' },
      { icon: 'timer', text: 'Planks and other holds now count seconds, not weight and reps.' },
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
