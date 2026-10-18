// ============================================================================
// punishmentsOffenses.js
// The four main categories of the Punishments page (/rules/punishments), every offense
// as one embed with what counts, the exact punishment ladder and the details around it:
//   Discord      chat, content and account offenses on the Discord server
//   Minecraft    conduct on the servers and during tier testing
//   Cheating     cheats, refusing or dodging a screenshare, hiding evidence, bypasses
//   General      how punishments work, accounts, honesty, ban evasion and appeals
// The Screenshare procedure (the golden charter) lives in punishmentsCharter.js and the
// cheating category follows it: every number here that the charter also quotes (the
// 5 and 10 minute limits, the 14 day appeal window) must stay in step with it.
// Change a length below and the ladder, the search and the sidebar follow.
// ============================================================================
import { entry, facts, ladder, ladderOf, row, step, stage, steps, term, terms, text } from './punishmentsKit';

// ----------------------------------------------------------------------------
// How long an offense counts towards the next step of its ladder, by severity.
// General has an embed that explains this, keep the two in step.
// ----------------------------------------------------------------------------
const windows = {
  minor: '60 days',
  moderate: '120 days',
  severe: '1 year',
  critical: 'It never expires',
};

// The standard appeal line (the charter quotes the same 14 days)
const appealLine = 'Once, in <#appeals>, within 14 days of the punishment';

// ----------------------------------------------------------------------------
// offense(): one embed in the shared layout. `what` says what counts, `points` are the
// bullet examples, `ladder` is the punishment block, `facts` adds extra label / value
// pairs after the two standard ones (counts for, appeal) and `after` is a small note.
// ----------------------------------------------------------------------------
const offense = (slug, title, level, { what, points = [], ladder: punishment, facts: extra = [], appeal = appealLine, after }) =>
  entry(
    slug,
    title,
    level,
    text(what, ...(points.length ? ['', ...points.map((point) => `- ${point}`)] : [])),
    punishment,
    facts(['Counts for', windows[level]], ['Appeal', appeal], ...extra),
    ...(after ? [text(`-# ${after}`)] : []),
  );

// ============================================================================
// DISCORD
// Punishments here are a warning, a mute (a Discord timeout), a kick, a server ban
// (banned from the Discord server) or a permanent ban.
// ============================================================================
const discord = {
  id: 'discord',
  name: 'Discord',
  title: 'Discord offenses',
  summary: 'Chat, content and account offenses on the Kyriadon Discord server, with the exact punishment for every repeat.',
  icon: 'discord',
  entries: [
    // ------------------------------------------------------------------------
    offense('spam', 'Spam and flooding', 'minor', {
      what: 'Filling a channel with noise so other people cannot read it. This is the most common offense and the lightest one.',
      points: [
        'The same message, emoji or sticker sent again and again',
        'Walls of capital letters or a long run of symbols',
        'Several messages in a row that could have been one',
        'Using bot commands outside the bot channels to flood a chat',
      ],
      ladder: ladderOf(['warn'], ['mute', '1 hour'], ['mute', '12 hours'], ['serverban', '3 days']),
      facts: [['Staff look at', 'How many messages, how fast, and whether it was clearly on purpose']],
      after: 'A burst of spam inside a single minute counts as one offense, not one per message.',
    }),

    // ------------------------------------------------------------------------
    offense('mentions', 'Pinging and mass mentions', 'minor', {
      what: 'Pinging people or roles without a reason, or pinging again before anyone had a chance to answer.',
      points: [
        'Pinging <@&staff> or a whole role for something that is not urgent',
        'Repeated pings to the same person within a short time',
        'Mass mentions, including `@everyone` and `@here` where they are not allowed',
      ],
      ladder: ladderOf(['warn'], ['mute', '1 hour'], ['mute', '1 day']),
      facts: [['Better way', 'Open a ticket in <#support>, staff see it without a ping']],
    }),

    // ------------------------------------------------------------------------
    offense('channels', 'Wrong channel and off-topic chat', 'minor', {
      what: 'Posting where the post does not belong. Every channel has a description, and reading it is part of using it.',
      points: ['Off-topic conversations in a topic channel', 'Questions that the guides on the website already answer', 'Bot commands outside the bot channels'],
      ladder: ladderOf(['none', undefined, 'Staff point you to the right channel'], ['warn'], ['mute', '30 minutes']),
    }),

    // ------------------------------------------------------------------------
    offense('disrespect', 'Disrespect and insults', 'moderate', {
      what: 'Treating a member or a staff member without respect. Disagreeing is fine, attacking the person is not.',
      points: [
        'Insults, name calling and mocking someone for how they play or what tier they have',
        'Arguing with a staff decision in public instead of in a ticket',
        'Baiting people into an argument',
        'Continuing after someone has asked you to stop',
      ],
      ladder: ladderOf(['warn'], ['mute', '6 hours'], ['mute', '3 days'], ['serverban', '7 days']),
      facts: [['Staff look at', 'The wording, whether it was aimed at one person and whether it continued after a warning']],
    }),

    // ------------------------------------------------------------------------
    offense('harassment', 'Harassment and bullying', 'severe', {
      what: 'Targeting a person over time, in public channels or in direct messages. One heated message is disrespect, a pattern is harassment.',
      points: [
        'Following someone from channel to channel or into their messages',
        'Piling on with other people',
        'Repeated unwanted direct messages after being told to stop',
        'Using an alternate account to keep contacting someone who blocked you',
      ],
      ladder: ladderOf(['mute', '1 day'], ['serverban', '7 days'], ['serverban', '30 days'], ['perm']),
      facts: [['Evidence', 'Screenshots of the messages with the dates visible, sent through a ticket']],
    }),

    // ------------------------------------------------------------------------
    offense('hate', 'Hate speech and discrimination', 'severe', {
      what: 'Slurs, hateful jokes and discrimination about race, gender, religion, sexuality, disability or nationality. Intent does not matter, a joke that uses a slur is still a slur.',
      points: ['In messages, nicknames, statuses, avatars and voice chat', 'Quoting a slur "to make a point" is treated the same way', 'Symbols or code words that stand for hate'],
      ladder: ladder(
        row('1st offense', [step('mute', '3 days'), step('serverban', '14 days')]),
        row('2nd offense', [step('serverban', '60 days')]),
        row('3rd offense or later', [step('perm')]),
      ),
      facts: [['Skipping steps', 'Staff can go straight to a permanent ban for the worst cases']],
    }),

    // ------------------------------------------------------------------------
    offense('threats', 'Threats, doxxing and self-harm encouragement', 'critical', {
      what: 'The offenses staff never take lightly. They are removed on sight, the ladder does not apply and there is no warning.',
      points: ['Threats of violence, even as a joke', 'Posting or threatening to post personal information, such as addresses, photos or accounts', 'Telling someone to hurt themselves'],
      ladder: ladderOf(['perm', undefined, 'Immediate, no warning']),
      facts: [['Also', 'Serious cases can be reported to Discord, and to the authorities where the law requires it']],
      after: 'If you are in danger or someone else is, contact your local emergency number first, then tell staff.',
    }),

    // ------------------------------------------------------------------------
    offense('nsfw', 'NSFW and shocking content', 'severe', {
      what: 'Sexual, graphic or shocking content anywhere on the server. The server includes avatars, nicknames, statuses and bios, not only messages.',
      points: ['Images, videos, links and emojis', 'Profile pictures, banners and display names', 'Describing graphic content in text'],
      ladder: ladder(
        row('1st offense', [step('mute', '1 day')], 'The content is removed'),
        row('2nd offense', [step('serverban', '14 days')]),
        row('3rd offense or later', [step('perm')]),
      ),
    }),

    // ------------------------------------------------------------------------
    offense('links', 'Scam, phishing and malicious links', 'critical', {
      what: 'Links and files that can hurt someone else: malware, IP grabbers, token stealers, fake giveaways and fake login pages.',
      points: ['Sending them in channels or in direct messages', 'Sending them "by accident" from a hacked account, until it is secured'],
      ladder: ladderOf(['perm', undefined, 'The account is also reported to Discord']),
      facts: [['Hacked account', 'A compromised account is muted until its owner secures it and tells staff, then it is restored without a punishment']],
    }),

    // ------------------------------------------------------------------------
    offense('advertising', 'Advertising and unsolicited invites', 'moderate', {
      what: 'Promoting servers, products or social accounts nobody asked about.',
      points: ['Invite links in channels, and invites sent in direct messages to members', 'Promoting your own channel or stream outside the channels made for it', 'Selling services, accounts or ranks'],
      ladder: ladderOf(['warn'], ['mute', '1 day'], ['serverban', '7 days']),
      facts: [['Direct messages', 'An unsolicited invite sent in a direct message counts the same as one in a channel']],
    }),

    // ------------------------------------------------------------------------
    offense('impersonation', 'Impersonation', 'severe', {
      what: 'Pretending to be a staff member, a creator or another member.',
      points: ['Copying a name or avatar to look like someone else', 'Claiming a role you do not have', 'Claiming to speak for Kyriadon or its staff'],
      ladder: ladderOf(['serverban', '7 days'], ['serverban', '30 days'], ['perm']),
      facts: [['Roles', 'The only real roles are shown by the role itself, like <@&staff> or <@&creator>']],
    }),

    // ------------------------------------------------------------------------
    offense('privacy', 'Sharing private information', 'severe', {
      what: 'Sharing something that belongs to another person without their permission. Doxxing with a threat is covered by its own offense above.',
      points: ['Private messages and screenshots of private chats', 'Real names, locations, photos or account details', 'Posting screenshare or punishment evidence in public'],
      ladder: ladderOf(['mute', '3 days'], ['serverban', '14 days'], ['serverban', '60 days']),
      facts: [['Right way', 'Send evidence to staff in a ticket, never to a public channel']],
    }),

    // ------------------------------------------------------------------------
    offense('voice', 'Voice chat misuse', 'minor', {
      what: 'Anything that makes a voice channel hard to use for the people in it.',
      points: ['Shouting, soundboards, voice changers and music without everyone agreeing', 'Joining and leaving repeatedly', 'Recording people without telling them'],
      ladder: ladderOf(['warn'], ['mute', '1 hour'], ['mute', '1 day']),
      facts: [['Mute', 'A voice mute only covers voice channels, text chat stays open']],
    }),
  ],
};

// ============================================================================
// MINECRAFT
// Punishments here use a mute, a kick, a ban (from the Kyriadon Minecraft servers and
// from testing), a testing ban (only tier testing and queues), tier removal or a
// permanent ban. Offenses that involve cheats are in the cheating category.
// ============================================================================
const minecraft = {
  id: 'minecraft',
  name: 'Minecraft',
  title: 'Minecraft offenses',
  summary: 'Conduct on the servers and during tier testing: chat, griefing, teaming, dodging, boosting and everything around a test.',
  icon: 'cube',
  entries: [
    // ------------------------------------------------------------------------
    offense('game-chat', 'Chat, names and skins in game', 'minor', {
      what: 'The Discord respect rules apply in game too, in chat, on signs, in books, in player names and on skins.',
      points: ['Insults, slurs and spam in chat', 'Signs and books with the same content', 'Names and skins that would be removed on Discord'],
      ladder: ladderOf(['warn'], ['mute', '1 hour'], ['mute', '1 day'], ['ban', '3 days']),
      facts: [['Worse cases', 'Hate speech and threats are punished with the Discord offenses of the same name']],
    }),

    // ------------------------------------------------------------------------
    offense('griefing', 'Griefing', 'moderate', {
      what: 'Destroying, stealing from or ruining what belongs to another player or to a match. This applies in normal gamemodes. **In an SMP-based gamemode griefing is allowed** and is never punished.',
      points: ['Breaking builds and taking items that are not yours', 'Ruining a match on purpose, for example by trapping or blocking', 'Helping someone else do it'],
      ladder: ladderOf(['warn'], ['ban', '3 days'], ['ban', '14 days'], ['ban', '30 days']),
      facts: [
        ['Where it applies', 'Every normal gamemode. SMP-based gamemodes are the exception'],
        ['Restitution', 'Staff can ask you to give back what you took, if the server can restore it'],
      ],
    }),

    // ------------------------------------------------------------------------
    offense('spawn-camping', 'Spawn camping', 'minor', {
      what: 'Repeatedly killing players while they respawn or enter a match. This applies in normal gamemodes. **In an SMP-based gamemode spawn camping is allowed** and is never punished.',
      points: ['Standing at a spawn only to kill', 'Following a player back to their spawn on purpose'],
      ladder: ladderOf(['warn'], ['mute', '1 hour'], ['ban', '1 day']),
      facts: [
        ['Where it applies', 'Every normal gamemode. SMP-based gamemodes are the exception'],
        ['What is allowed', 'Winning a fight next to a spawn is fine, waiting there is not'],
      ],
    }),

    // ------------------------------------------------------------------------
    offense('teaming', 'Teaming and kill farming', 'moderate', {
      what: 'Working with opponents to inflate kills, wins or points, or teaming in a mode that does not allow it.',
      points: ['Agreeing not to fight each other', 'Trading wins or taking turns losing', 'Farming a friend or an alternate account'],
      ladder: ladder(
        row('1st offense', [step('warn'), step('tierreset')], 'Only the results that came from the farming are removed'),
        row('2nd offense', [step('ban', '7 days'), step('tierreset')]),
        row('3rd offense or later', [step('ban', '30 days'), step('tierreset')]),
      ),
      facts: [['Everyone involved', 'Both sides are punished, not only the one who asked']],
    }),

    // ------------------------------------------------------------------------
    offense('exploits', 'Exploits and bug abuse', 'moderate', {
      what: 'Using a glitch, a duplication method or an unintended mechanic to get ahead.',
      points: ['Duplicating items or currency', 'Using a bug to avoid damage, escape a match or reach places you should not', 'Teaching the method to other players'],
      ladder: ladderOf(['warn'], ['ban', '7 days'], ['ban', '30 days']),
      facts: [['Report it instead', 'A bug you report to staff is never punished, and the report is thanked']],
    }),

    // ------------------------------------------------------------------------
    offense('lag', 'Lag machines and crash devices', 'severe', {
      what: 'Anything that slows the server down or crashes it for other players.',
      points: ['Lag machines and redstone clocks built to overload the server', 'Items or entities spawned to crash clients', 'Tools or commands that do the same from outside the game'],
      ladder: ladderOf(['ban', '30 days'], ['perm']),
      facts: [['Intent', 'Accidental lag is not punished, building it on purpose is']],
    }),

    // ------------------------------------------------------------------------
    offense('real-money', 'Real-money deals', 'severe', {
      what: 'Buying, selling or trading accounts, items, ranks or tiers for real money or any outside currency.',
      points: ['Selling a tier, a test result or an account', 'Buying carries, boosts or results', 'Offering to do it in direct messages'],
      ladder: ladder(row('1st offense', [step('ban', '30 days'), step('tierreset')]), row('2nd offense or later', [step('perm')])),
      facts: [['Both sides', 'The buyer and the seller are punished']],
    }),

    // ------------------------------------------------------------------------
    offense('tester-conduct', 'Disrespecting testers', 'minor', {
      what: 'Testers give their time for free. Be polite and accept the result.',
      points: ['Insulting or arguing with a tester during or after a match', 'Spamming testers in direct messages', 'Begging for a different result or tier'],
      ladder: ladderOf(['warn'], ['testban', '3 days'], ['testban', '14 days']),
      facts: [['Disagree with a result?', 'Open a ticket in <#support> with the details, public complaints change nothing']],
    }),

    // ------------------------------------------------------------------------
    offense('no-show', 'Missing your testing slot', 'minor', {
      what: 'A tester accepts you, so you must be online and ready. The queue in <#testing> has a limited number of slots.',
      points: ['Not answering after your slot was accepted', 'Queueing and leaving again and again', 'Spamming testers to skip the line'],
      ladder: ladderOf(['none', undefined, 'You lose your place in the queue'], ['testban', '1 day'], ['testban', '7 days']),
    }),

    // ------------------------------------------------------------------------
    offense('dodging', 'Dodging and stalling a test', 'moderate', {
      what: 'Leaving, crashing or stalling a match to avoid losing. In a tier test, dodging counts as a loss.',
      points: ['Closing the game or disconnecting during a test', 'Waiting for the timer instead of playing', 'Blaming lag without proof'],
      ladder: ladder(
        row('1st offense', [step('warn')], 'The test counts as a loss'),
        row('2nd offense', [step('testban', '3 days')], 'The test counts as a loss'),
        row('3rd offense or later', [step('testban', '14 days')]),
      ),
      facts: [['Real problems', 'A documented crash or power cut is force majeure, see the Screenshare procedure']],
    }),

    // ------------------------------------------------------------------------
    offense('false-details', 'False testing details', 'moderate', {
      what: 'Picking the wrong region, gamemode or version in the testing form, or giving false information about your setup.',
      points: ['A region that is not yours, to get a better ping', 'A gamemode or version you do not actually play', 'Wrong details given to staff in a ticket'],
      ladder: ladder(
        row('1st offense', [step('tierreset'), step('warn')], 'The result of that test is removed'),
        row('2nd offense', [step('testban', '7 days')]),
        row('3rd offense or later', [step('testban', '30 days')]),
      ),
    }),

    // ------------------------------------------------------------------------
    offense('boosting', 'Rigging, boosting and testing for others', 'severe', {
      what: 'Results have to be genuine, and a test only counts if you took it yourself on your own account.',
      points: ['Arranging a result, trading wins or playing with friends to get a better tier', 'Testing on someone else\'s account, or letting someone test on yours', 'Getting a friend to play your match for you'],
      ladder: ladder(
        row('1st offense', [step('testban', '30 days'), step('tierreset')]),
        row('2nd offense', [step('testban', '90 days'), step('tierreset')]),
        row('3rd offense or later', [step('perm')]),
      ),
      facts: [['Everyone involved', 'The player, the helper and the account owner are all punished']],
    }),

    // ------------------------------------------------------------------------
    offense('cooldown', 'Bypassing a cooldown', 'moderate', {
      what: 'After a test you have to wait for the cooldown before testing again.',
      points: ['Testing again on an alternate account', 'Asking another tester to ignore the cooldown', 'Changing your name or details to look like a new player'],
      ladder: ladder(
        row('1st offense', [step('tierreset')], 'The new result is cancelled'),
        row('2nd offense', [step('testban', '7 days')]),
        row('3rd offense or later', [step('testban', '30 days')]),
      ),
    }),

    // ------------------------------------------------------------------------
    offense('events', 'Ignoring event hosts', 'minor', {
      what: 'During matches and events, staff, referees and hosts have the last word.',
      points: ['Ignoring an instruction from a host or referee', 'Joining a different server or mode than the one you were assigned', 'Leaving an event match without telling anyone'],
      ladder: ladderOf(['warn'], ['kick', undefined, 'Removed from the event'], ['ban', '3 days']),
    }),
  ],
};

// ============================================================================
// CHEATING
// Cheats and everything around a screenshare. Every offense here is judged by the
// Screenshare procedure above: the consent, the time limits, the evidence and the
// appeals work exactly as written there. A ban in this category is a ban from the
// Kyriadon Minecraft servers and from tier testing, and the tier results around the
// offense are reviewed.
// ============================================================================
const cheating = {
  id: 'cheating',
  name: 'Cheating',
  title: 'Cheating and screenshare offenses',
  summary: 'Cheats, refusing or dodging a screenshare, hiding evidence and bypasses. Every offense follows the Screenshare procedure.',
  icon: 'crosshair',
  entries: [
    // ------------------------------------------------------------------------
    offense('cheats', 'Cheats and illegal modifications', 'severe', {
      what: 'Any advantage that normal gameplay does not give you. What counts as a modification is decided by the screensharer, with the evidence shown to you.',
      points: ['Hacked clients and cheat injectors', 'Autoclickers, macros and anything that automates input', 'Reach, velocity, aim assist, triggerbots and similar', 'Disallowed mods, such as ones that remove the hit delay'],
      ladder: ladder(
        row('1st offense', [step('ban', '30 days'), step('tierreset')]),
        row('2nd offense', [step('ban', '90 days'), step('tierreset')]),
        row('3rd offense or later', [step('perm')]),
      ),
      facts: [
        ['Needs', 'A detection by the required scanner that was confirmed by hand, or something found by the screensharer with the evidence shown'],
        ['Allowed', 'Launchers and mods that only change performance or visuals and give no advantage'],
      ],
    }),

    // ------------------------------------------------------------------------
    offense('mods', 'Disallowed mods, macros and resource packs', 'moderate', {
      what: 'Things that give an edge without being a cheat client. The allowed list is the reference, and asking before you join costs nothing.',
      points: ['Mods that are not on the allowed list', 'Key bindings or scripts that run several actions at once', 'Resource packs and settings that change hitboxes, remove blocks or show more than vanilla'],
      ladder: ladderOf(['ban', '7 days'], ['ban', '30 days'], ['ban', '90 days']),
      facts: [['Not sure?', 'Ask in <#support> before you join, a question is never punished']],
    }),

    // ------------------------------------------------------------------------
    offense('mouse', 'More than one mouse connected', 'minor', {
      what: 'Only one mouse may be plugged in while you play or test, because a second one can hide a macro device.',
      points: ['Two mice at the same time, even if one is broken', 'A mouse with its software closed or not installed'],
      ladder: ladderOf(['ban', '3 days'], ['ban', '7 days'], ['ban', '14 days']),
      facts: [['How it is checked', 'With `Get-PnpDevice -Class Mouse -PresentOnly`, see the commands in the Screenshare procedure']],
    }),

    // ------------------------------------------------------------------------
    offense('services', 'Disabled Windows services', 'moderate', {
      what: 'Some Windows services write the records a screenshare reads. Turning them off leaves a gap that nobody can look into.',
      points: ['The services are `SysMain`, `PcaSvc`, `DPS`, `EventLog`, `Schedule`, `WSearch`, `Appinfo` and `DusmSvc`', 'System optimizers and "tweak" tools that switch them off', 'Customised Windows builds that cannot turn them back on'],
      ladder: ladderOf(['ban', '7 days'], ['ban', '21 days'], ['ban', '60 days']),
      facts: [
        ['How it is checked', 'With `Get-Service`, see the commands in the Screenshare procedure'],
        ['Verify first', 'Open a ticket in <#support> and ask staff to look, before you are ever in a screenshare'],
      ],
      after: 'Keeping the services on is your responsibility. Leaving them off without checking is not treated with leniency.',
    }),

    // ------------------------------------------------------------------------
    offense('admitting', 'Admitting to cheating', 'severe', {
      what: 'Telling the screensharer, or showing them, that you are using an advantage. It is treated like a detection.',
      points: ['Saying you use a client, a macro or an autoclicker', 'Showing the software when asked', 'Telling the screensharer you cheated in the match that was reported'],
      ladder: ladder(
        row('1st offense', [step('ban', '14 days'), step('tierreset')], 'Shorter than being caught, because you were honest'),
        row('2nd offense', [step('ban', '30 days'), step('tierreset')]),
        row('3rd offense or later', [step('ban', '60 days'), step('tierreset')]),
      ),
    }),

    // ------------------------------------------------------------------------
    offense('refusing', 'Refusing a screenshare', 'severe', {
      what: 'Saying you will not take the screenshare, or ending it before it is over. It applies to the required steps only, an optional tool can always be declined.',
      points: ['Saying no to the remote connection or to the required scanner', 'Withdrawing consent once the session has started', 'Naming a screensharer you want to be checked by, in a hosted event'],
      ladder: ladder(
        row('1st offense', [step('ban', '14 days'), step('tierreset')]),
        row('2nd offense', [step('ban', '30 days'), step('tierreset')]),
        row('3rd offense or later', [step('ban', '60 days'), step('tierreset')]),
      ),
      facts: [['Allowed', 'Declining an optional tool, or asking for a different screensharer. Nothing is forced, see Player rights']],
    }),

    // ------------------------------------------------------------------------
    offense('stalling', 'Stalling a screenshare', 'moderate', {
      what: 'Slowing the screenshare down or going quiet after you were frozen.',
      points: ['Not showing up in the ticket within **5 minutes** of the freeze', 'Not complying with the screensharer within **10 minutes** of the claim', 'Queueing a second match before the screenshare is claimed', 'Going AFK while frozen, or reconnecting over and over'],
      ladder: ladderOf(['ban', '7 days'], ['ban', '14 days'], ['ban', '30 days']),
      facts: [['Show presence', 'Typing a message in the ticket is enough']],
    }),

    // ------------------------------------------------------------------------
    offense('closing', 'Closing Minecraft, shutting down or leaving', 'severe', {
      what: 'Closing the game, shutting the PC down, rebooting it or leaving the Discord server after you were frozen, whatever the reason.',
      points: ['Closing Minecraft or the remote tool mid-session, even if the game crashes', 'Shutting down or rebooting the PC', 'Leaving the Discord server while frozen, or before the request exists'],
      ladder: ladderOf(['ban', '14 days'], ['ban', '30 days'], ['ban', '60 days']),
      facts: [
        ['No penalty', 'Closing Minecraft after the 10 minute mark when nobody has answered you'],
        ['Real problems', 'A documented crash or power cut is force majeure, tell the screensharer as soon as you can'],
      ],
    }),

    // ------------------------------------------------------------------------
    offense('inability', 'Inability to take a screenshare', 'minor', {
      what: 'A screenshare that cannot happen for a reason that is not your fault. This is the lightest offense in the category and the only one with five steps.',
      points: ['A very slow PC or connection, or no admin rights', 'Problems with the remote tool that you did not cause', 'A customised system where staff cannot do their checks'],
      ladder: ladderOf(['ban', '2 days'], ['ban', '3 days'], ['ban', '7 days'], ['ban', '14 days'], ['ban', '30 days']),
      facts: [
        ['If you can run the scanner', 'Agreeing to the required scanner and running it successfully pardons the inability'],
        ['If it was caused on purpose', 'It is punished as stalling or as a bypass attempt, never as this offense'],
      ],
    }),

    // ------------------------------------------------------------------------
    offense('deleting', 'Deleting files before a screenshare', 'severe', {
      what: 'Removing, moving or renaming files after you were warned not to log off or after you were frozen.',
      points: ['Deleting a client, a mod or a folder', 'Emptying the recycle bin, the Recent items or the Minecraft logs', 'Running cleaners or optimizers close to the screenshare'],
      ladder: ladder(
        row('1st offense', [step('ban', '30 days'), step('tierreset')]),
        row('2nd offense', [step('ban', '60 days'), step('tierreset')]),
        row('3rd offense or later', [step('ban', '90 days'), step('tierreset')]),
      ),
      facts: [['How it is seen', 'Through the change journal, the Recent folder and the Minecraft logs, see the commands in the Screenshare procedure']],
    }),

    // ------------------------------------------------------------------------
    offense('anti-forensic', 'Anti-forensic software', 'severe', {
      what: 'Owning or running software that hides, deletes or changes evidence on a device, including anything built to beat screenshare tools.',
      points: ['Log, journal and trace cleaners', 'File shredders and string cleaners', 'Hardware that gets around a screenshare, such as direct memory access cards'],
      ladder: ladderOf(['ban', '60 days'], ['ban', '180 days'], ['perm']),
      facts: [['Also counts', 'Having it on the PC, even if it was not run during the screenshare']],
    }),

    // ------------------------------------------------------------------------
    offense('bypass', 'Bypass attempts', 'critical', {
      what: 'Anything done to hide a rule break from a screenshare. A bypass attempt is worse than the offense it hides.',
      points: [
        'Clearing the event log (event 104 in the `System` log is the sign), the journal, the registry or the Prefetch folder',
        'Restarting or stopping services right before a screenshare',
        'Replacing or overwriting files, running scheduled scripts or using virtual drives',
        'Switching PCs, or showing a clean device in place of the real one',
        'Lying to the screensharer about your setup, or picking a lighter offense on purpose',
      ],
      ladder: ladderOf(['ban', '90 days'], ['ban', '180 days'], ['perm']),
      facts: [['Worst cases', 'Switching PCs or using a bypass that is for sale starts at a permanent ban and cannot be appealed verbally']],
    }),

    // ------------------------------------------------------------------------
    offense('paid-bypass', 'Using or selling a paid bypass', 'critical', {
      what: 'Using a bypass that is sold to players, or making, selling or sharing one, even for free.',
      points: ['Software sold to get around screenshares', 'Passing it on in direct messages or in public', 'Recommending it to other players'],
      ladder: ladderOf(['perm', undefined, 'Starts at a permanent ban, there is no ladder']),
      appeal: 'Not appealable',
      facts: [['Only way back', 'A management-approved unban, and only if you cause no further problems']],
    }),

    // ------------------------------------------------------------------------
    offense('bribery', 'Bribing a screensharer', 'critical', {
      what: 'Offering or giving anything of value to a screensharer in exchange for a good result.',
      points: ['Money, items, ranks or favors', 'Offering it before, during or after a screenshare', 'Doing it through another person'],
      ladder: ladderOf(['perm', undefined, 'Starts at a permanent ban, there is no ladder']),
      appeal: 'Not appealable',
      facts: [['The screensharer', 'A screensharer who takes a bribe is demoted at once, and the same applies to a <@&ss-manager>']],
      after: 'There is no verbal appeal for this offense.',
    }),

    // ------------------------------------------------------------------------
    offense('ss-misuse', 'Screenshare misuse', 'moderate', {
      what: 'Abusing the report system. Reports exist to protect fair players, not to get back at someone.',
      points: [
        'Revenge reports, or reporting someone to stop them from queueing',
        'Reports that are false, as a joke or from a loss',
        'Bribing or tricking someone into breaking the screenshare rules',
        'Reusing a screenshot from an expired report to get around a limit',
      ],
      ladder: ladderOf(['warn', undefined, 'No reports for 24 hours'], ['ban', '3 days', 'Reports are blocked for the same length'], ['ban', '7 days'], ['ban', '14 days']),
      facts: [['Where reports go', 'Only through a report ticket in <#support>, see Reporting a suspect']],
    }),
  ],
};

// ============================================================================
// GENERAL
// How punishments work, and the offenses that apply everywhere Kyriadon exists.
// ============================================================================
const general = {
  id: 'general',
  name: 'General',
  title: 'General offenses',
  summary: 'How punishments are chosen and counted, plus accounts, honesty, ban evasion and appeals, wherever Kyriadon exists.',
  icon: 'shield',
  entries: [
    // ------------------------------------------------------------------------
    entry(
      'types',
      'Punishment types',
      null,
      text('Every ladder in this schedule is built from the same few punishments. Each one is shown with a text label and, where it applies, its exact length.'),
      terms(
        term('No punishment', 'success', 'A reminder. Staff tell you what to do differently and nothing is recorded as a punishment.'),
        term('Warning', 'warning', 'A written warning. It stays on your record for the counting period of the offense.'),
        term('Mute', 'info', 'You cannot write or speak for the length shown. On Discord it is a timeout, in game it is a chat mute.'),
        term('Kick', 'neutral', 'You are removed from the server or the event, and you can come back straight away.'),
        term('Ban', 'danger', 'You cannot join the Kyriadon Minecraft servers or take tier tests for the length shown. Discord stays open.'),
        term('Server ban', 'danger', 'You are banned from the Kyriadon Discord server for the length shown.'),
        term('Testing ban', 'danger', 'You cannot queue or take tier tests for the length shown. You can still play and chat.'),
        term('Tier removed', 'warning', 'The tier results connected to the offense are removed, with or without a ban.'),
        term('Permanent ban', 'danger', 'The ban has no end date. Only management can lift it, and only after an appeal that succeeds.'),
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'ladders',
      'How ladders and repeats work',
      null,
      text(
        'A ladder is the list of steps an offense follows. Every time you repeat the same offense inside its counting period, you move one step up. The last step stays the last step.',
        '',
        '- Staff choose a punishment from the severity, the intent and your history, and **serious offenses can skip steps**',
        '- Two offenses at the same time do not add up, the longer punishment applies',
        '- A ban always counts from the moment it is issued',
        '- Offenses that have no ladder start at the step shown, for example a permanent ban',
      ),
      facts(
        ['Minor offenses', `Count for ${windows.minor}`],
        ['Moderate offenses', `Count for ${windows.moderate}`],
        ['Severe offenses', `Count for ${windows.severe}`],
        ['Critical offenses', windows.critical],
        ['Appeal', 'An appeal that succeeds removes the offense, and the step it counted for'],
      ),
      text('-# The period starts on the day of the last offense of the same kind. Staff never raise a punishment because of an offense that has expired.'),
    ),

    // ------------------------------------------------------------------------
    offense('ban-evasion', 'Ban evasion and alternate accounts', 'severe', {
      what: 'Joining on another account to get around a ban, a mute, a cooldown or a tier decision.',
      points: ['Making a new Discord or Minecraft account while you are banned', 'Using an alternate account to take a test again', 'Helping someone else do it, or lending your account for it'],
      ladder: ladder(
        row('1st offense', [step('ban', 'The original, restarted')], 'The alternate account is banned too, and the original punishment is upgraded one step'),
        row('2nd offense or later', [step('perm')]),
      ),
      facts: [['Alternate accounts', 'Allowed only when staff know about them, for example after a lost account']],
    }),

    // ------------------------------------------------------------------------
    offense('account-sharing', 'Sharing or selling accounts', 'severe', {
      what: 'Your account is yours alone. Tiers, roles and perks belong to the person who earned them and cannot be transferred or traded.',
      points: ['Giving your login or session to someone else', 'Logging in for someone else', 'Selling, buying or lending a tier, a role or an account'],
      ladder: ladder(
        row('1st offense', [step('ban', '30 days'), step('tierreset')]),
        row('2nd offense or later', [step('perm')]),
      ),
      facts: [['Hacked accounts', 'Tell staff right away, actions from a hacked account count against you until it is reported']],
    }),

    // ------------------------------------------------------------------------
    offense('false-registration', 'False registration details', 'moderate', {
      what: 'Everything you give staff, in forms and in tickets, has to be accurate. This is the first thing you do with <#register>, so it is also the first thing that can go wrong.',
      points: ['Linking Minecraft or Discord accounts that belong to someone else', 'Wrong details in the registration or in a ticket', 'Lying to staff or to testers when asked directly'],
      ladder: ladder(
        row('1st offense', [step('warn')], 'Your registration is cancelled until it is correct'),
        row('2nd offense', [step('ban', '7 days')]),
        row('3rd offense or later', [step('ban', '30 days')]),
      ),
      facts: [['Lying in an investigation', 'It is punished as seriously as the original offense, and as a bypass attempt in a screenshare']],
    }),

    // ------------------------------------------------------------------------
    offense('staff-instructions', 'Ignoring staff instructions', 'moderate', {
      what: 'Staff make the final call in the moment. Comply first and open a ticket afterwards.',
      points: ['Continuing after staff told you to stop', 'Arguing with a decision instead of using a ticket', 'Pretending not to see a message from staff'],
      ladder: ladderOf(['warn'], ['mute', '6 hours'], ['serverban', '3 days']),
      facts: [['If staff are wrong', 'Report it in a ticket or to an admin, staff are held to the same rules']],
    }),

    // ------------------------------------------------------------------------
    offense('callouts', 'Public callouts and drama', 'minor', {
      what: 'Evidence, accusations and arguments belong in tickets and appeals, not in public channels.',
      points: ['Posting punishment evidence or accusations in public', 'Dragging a personal conflict from another server into Kyriadon', 'Calling someone out instead of reporting them'],
      ladder: ladderOf(['warn'], ['mute', '12 hours'], ['mute', '3 days']),
    }),

    // ------------------------------------------------------------------------
    offense('role-begging', 'Begging for roles, tiers and perks', 'minor', {
      what: 'Roles are earned through registration and testing. Boosting and supporting follow the same rules as everyone else and are never a way to get out of a punishment.',
      points: ['Asking staff for a role, a permission or a tier change', 'Asking again after being told no', 'Offering something in return'],
      ladder: ladderOf(['none', undefined, 'Staff explain how roles are earned'], ['warn'], ['mute', '1 day']),
    }),

    // ------------------------------------------------------------------------
    entry(
      'appeals',
      'Appealing a punishment',
      null,
      text('You can appeal any punishment in this schedule except the ones marked not appealable. An appeal is judged on the rules and on the evidence, never on who is asking.'),
      steps(
        stage('Open an appeal in <#appeals>', 'Do it within **14 days** of the punishment. Say which offense you were given, why you think it is wrong and add anything that supports you.'),
        stage('Staff review it', 'A staff member who was not part of the case reads it. They write the decision with the reason, and it is sent to you in the ticket.'),
        stage('The result', 'A successful appeal removes the punishment and the offense. A denied one stands, and you are told what to do differently.'),
        stage('Screenshare cases', 'Punishments from a screenshare follow their own four steps in the Screenshare procedure, including the final review by a <@&ss-manager>.'),
      ),
      facts(
        ['Deadline', '14 days after the punishment'],
        ['How many', 'One appeal per punishment'],
        ['Not appealable', 'Bribing a screensharer and using or selling a paid bypass'],
        ['Be honest', 'A false appeal is punished as false registration details'],
      ),
      text('-# Do not post your appeal or its evidence in public. It makes no difference to the result and it is a callout.'),
    ),
  ],
};

// ----------------------------------------------------------------------------
// The four main categories, in page order (the page puts the charter before them)
// ----------------------------------------------------------------------------
export const categories = [discord, minecraft, cheating, general];
