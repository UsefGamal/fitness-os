// What changed, per released version, in the words a friend would use.
// Add an entry for the next version when a pull request changes something
// a person will notice; three to six short lines, newest version first.
// The version is the tag without the "v". lib/whatsNew.js decides which
// of these a phone still has to see.
export const WHATS_NEW = [
  {
    version: '0.9.8',
    items: [
      { icon: 'barbell', text: 'Weight jumps fit the move: 1 kg for small moves, 2 kg for dumbbells, and never much more than a tenth of the load.' },
      { icon: 'person', text: 'Push-ups, planks and other bodyweight moves grow by reps, then point you to a harder version.' },
      { icon: 'user', text: 'Setup asks if your day is mostly sitting, on your feet or physical work, so your calories start closer to right.' },
      { icon: 'meals', text: 'A meal you ticked keeps its numbers for good. Ate something else? You can add its carbs and fat too.' },
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
