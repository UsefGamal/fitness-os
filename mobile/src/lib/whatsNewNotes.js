// What changed, per released version, in the words a friend would use.
// Add an entry for the next version when a pull request changes something
// a person will notice; three to six short lines, newest version first.
// The version is the tag without the "v". lib/whatsNew.js decides which
// of these a phone still has to see.
export const WHATS_NEW = [
  {
    version: '0.9.6',
    items: [
      { icon: 'home', text: 'Home is shorter: today\'s session, your weight and today\'s numbers. The week is on Plan.' },
      { icon: 'play', text: 'During a workout, Pause, Finish and Discard are in one menu, with a Finish button after the last exercise.' },
      { icon: 'download', text: 'The backup reminder is now one thin line.' },
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
