// ============================================================================
// punishmentsCharter.js
// The Screenshare procedure (the golden "Charter by Kyriadon" panel). Written for the
// Kyriadon community: consent first, one clear path from report to verdict, every tool
// and every command explained, and the rights a player keeps the whole way through.
// The numbers here (minutes, days) are the live values. Change one and every place that
// quotes it needs the same change, so search this file for the old number first.
// ============================================================================
import { command, commands, entry, facts, group, stage, steps, term, terms, text, tools } from './punishmentsKit';

export const charter = {
  id: 'charter',
  name: 'Screenshare procedure',
  title: 'Screenshare procedure',
  summary: 'How a screenshare is requested, run and ended: the tools, the commands, the time limits and the rights every player keeps.',
  icon: 'scroll',
  entries: [
    // ------------------------------------------------------------------------
    entry(
      'purpose',
      'Purpose and scope',
      null,
      text(
        'A screenshare is how staff check that a player is competing fairly. It exists to protect the people who play honestly, and it is only ever started from a **valid report** and with the **player\'s consent**.',
        '',
        '- It applies to every player, whatever their role, once they are reported and frozen',
        '- It covers Minecraft tier tests, ranked-style matches and events run by Kyriadon',
        '- It does not cover anything outside the community, and nobody is inspected "just because"',
        '- Anything this charter does not forbid is allowed',
      ),
      facts(
        ['Version', 'Charter 1.0'],
        ['Effective', 'October 17, 2026'],
        ['Run by', '<@&screensharer> and <@&ss-manager>'],
        ['Questions', '<#support>'],
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'consent',
      'Consent',
      null,
      text(
        'Nothing on your PC is looked at until you agree. Agreement can be spoken, typed in the ticket or shown by your actions, and you can withdraw it at any time. Withdrawing counts as a refusal, see the offense in the cheating category.',
        '',
        '- **Explicit consent:** you say yes to the manual check, to the scanners and to the remote connection',
        '- **Implied consent:** accepting the remote connection or running a required scanner counts as agreeing to that part',
        '- **Optional tools:** a tool that is not marked required can be declined without penalty, the screensharer then checks that part by hand',
        '- **No force:** nobody can make you share your screen, and nobody will try',
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'definitions',
      'Definitions',
      null,
      terms(
        term('Player', 'neutral', 'Anyone in the community. A player cannot be frozen, inspected or punished under this charter until they become a suspect.'),
        term('Reporter', 'info', 'The player who reports a suspect. A reporter must have played against, warned or watched the suspect in the match.'),
        term('Suspect', 'warning', 'A reported player who has been frozen. The status lasts until the screenshare ends with a verdict.'),
        term('Frozen', 'warning', 'The state after a valid report: the suspect may not leave the server, close the game or shut the PC down until the screensharer says so. The <@&frozen> role marks it.'),
        term('Screensharer', 'success', 'A trained team member whose only job is to run screenshares. Screensharers are kept separate from moderation duties. Also called an inspector.'),
        term('Screenshare Manager', 'success', 'Leads the team, owns this charter and decides second-instance appeals.'),
        term('Ticket', 'neutral', 'The private channel where the screensharer and the suspect talk during a screenshare. Everything said and decided is written there.'),
        term('Verdict', 'info', 'The result: clean, pending, detected, admitted or refused. See the verdicts section.'),
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'authority',
      'Who decides what',
      null,
      text(
        'The charter is the only document that governs screenshares. A ticket, an appeal or a request must follow it, and nobody can overrule it for one player.',
        '',
        '- Only <@&ss-manager> can change the charter; changes take effect after an announcement in <#rules>',
        '- <@&staff> who are not on the screenshare team cannot inspect players or their PCs, they can only pass reports on',
        '- A person who is not part of the team has no authority here, and a suspect may refuse them without penalty',
        '- Where the evidence is thin or disputed, the decision favors the suspect and the case stays pending',
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'reporting',
      'Reporting a suspect',
      null,
      text('A report starts everything. Reports that skip these steps can be denied, so it pays to do them properly.'),
      steps(
        stage('Warn them in the match', 'Tell the suspect you will report them and ask them not to leave. A report without a warning can still be valid, but a warned suspect cannot say they never saw it.'),
        stage('Take the screenshots', 'One full screenshot with the **entire chat open** (press `T`), and one of the **scoreboard with the date visible**. Both must show the player you are reporting.'),
        stage('Open a ticket in <#reports>', 'Do it from the second half of the match until **10 minutes after it ends**. Write who you suspect and what you saw, and attach the screenshots.'),
        stage('Wait for a screensharer', 'A screensharer claims the ticket, checks your evidence and, if it holds, freezes the suspect. Keep the match result screenshot until the case is closed.'),
      ),
      facts(
        ['Report window', 'Second half of the match until 10 minutes after it ends'],
        ['Per reporter', 'One screenshare request on the same suspect per day'],
        ['Per suspect', 'At most 4 screenshares per day, from all reporters together'],
        ['Cooldown', '30 minutes after a ticket expires unclaimed; none after an instant denial'],
        ['Not accepted', 'Reports in public chat, from spectators, or on behalf of a muted player'],
      ),
      text('-# Reporting out of spite after a loss is screenshare misuse. A reporter judged to have done it cannot report for the next 24 hours.'),
    ),

    // ------------------------------------------------------------------------
    entry(
      'frozen',
      'When you are frozen',
      null,
      text(
        'You are frozen when a screensharer tells you in the ticket (or in your DMs). From that moment the clock starts, and a few things are asked of you.',
        '',
        '- Show up in the ticket within **5 minutes**: typing a message there is enough',
        '- Do **not** close Minecraft, shut down or restart the PC, or leave the Discord server',
        '- Do **not** delete, move or rename files, and do not run cleaners or optimizers',
        '- Keep your DMs open and your notifications on, closed DMs do not excuse a missed message',
        '- You may finish the match you are in. You may queue for **one** more match before the screenshare is claimed, a second counts as stalling',
      ),
      facts(
        ['Show presence', 'Within 5 minutes of the freeze'],
        ['Comply with the screensharer', 'Within 10 minutes of the claim'],
        ['Closing Minecraft', 'No penalty if it happens after the 10 minute mark with no response from staff'],
        ['Not knowing the rules', 'Does not excuse an offense, this page is the rules'],
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'procedure',
      'How a screenshare runs',
      null,
      text('Every screenshare follows the same order. The screensharer explains each step before doing it, and you can ask what any step does.'),
      steps(
        stage('Claim and introduce', 'A <@&screensharer> claims the ticket, says who they are and explains what is about to happen. The clock for the session starts at their first message.'),
        stage('Ask for consent', 'You are told which tools are required and which are optional. You agree, decline the optional ones, or refuse. Nothing starts before you answer.'),
        stage('Connect', 'You install and open **AnyDesk**, send the address it shows and accept the connection. You decide which permissions to allow, and you can end it at any time.'),
        stage('Scan', 'The required scanner runs first. It reads the PC for known cheat traces and writes a report. A detection is a reason to talk, not an instant verdict.'),
        stage('Check by hand', 'The screensharer checks recent activity, running processes and the Minecraft folders using the tools and commands listed below. You can watch everything and move your own mouse.'),
        stage('Ask and listen', 'Anything unclear is put to you directly. Honest answers help you, a false answer is treated as a bypass attempt.'),
        stage('Verdict', 'The screensharer writes the verdict in the ticket with the reason and the evidence that backs it. If it is a punishment, you are told the offense, the length and how to appeal.'),
        stage('Close', 'The connection ends, you are unfrozen and the ticket is closed. Records are kept for 90 days.'),
      ),
      facts(
        ['Typical length', '20 minutes'],
        ['Maximum length', '60 minutes (90 for events)'],
        ['Screensharer away', 'Up to 10 minutes before connecting, after that the request is void'],
        ['No replacement', 'You are free to leave if nobody replaces a departed screensharer within 15 minutes'],
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'tools',
      'Tools used in a screenshare',
      null,
      text(
        'Screensharers use well-known, publicly available tools. None of them changes your PC: they read, they list and they compare. Tools marked **required** cannot be declined, everything else is optional.',
      ),
      tools(
        {
          name: 'AnyDesk',
          kind: 'Remote access',
          href: 'https://anydesk.com',
          text: 'Lets the screensharer see your screen and, if you allow it, use the mouse and keyboard next to you. It is the connection every screenshare runs over. **Required** for a full screenshare.',
          looks: 'You open the app, read out the address it shows, click Accept and choose the permissions. The permission list (control, clipboard, file transfer) is yours to switch, and closing the window ends the session.',
        },
        {
          name: 'Echo',
          kind: 'Required scanner',
          href: 'https://echo.ac',
          text: 'An automated scanner built for Minecraft screenshares. It checks the PC for traces of known cheats and prohibited modifications and produces a report the screensharer reads. **Required**, a player cannot refuse it.',
          looks: 'You download and run it when the screensharer asks, and keep it open until it finishes. A result with detections is reviewed by hand before any verdict, a clean result does not end the screenshare by itself.',
        },
        {
          name: 'Everything',
          kind: 'File search',
          href: 'https://www.voidtools.com',
          text: 'Searches file names across your drives almost instantly by reading the NTFS index. It is used to look for known client names, `.jar` files and anything recently created or modified.',
          looks: 'The screensharer types a name or a pattern and sorts by date modified. Files are only listed, never opened without a reason.',
        },
        {
          name: 'System Informer',
          kind: 'Process viewer',
          text: 'A process and system viewer, the open-source successor of Process Hacker. It shows what is running, what each process loaded and which connections it holds open, down to the Minecraft Java process.',
          looks: 'The screensharer looks at `javaw.exe` and its loaded modules, at unsigned or oddly placed processes and at services that should be running. It is a staff-only tool, players do not run it on their own PC during a screenshare.',
        },
        {
          name: 'NirSoft utilities',
          kind: 'Activity viewers',
          href: 'https://www.nirsoft.net',
          text: 'Small, single-purpose programs that turn Windows records into readable tables. LastActivityView lists what was run and opened, WinPrefetchView reads the Prefetch folder and USBDeview lists the USB devices the PC has seen.',
          looks: 'Used to build a timeline around the match and to confirm which devices are connected. Each one is read only.',
        },
        {
          name: 'Eric Zimmerman tools',
          kind: 'Forensic parsers',
          href: 'https://ericzimmerman.github.io',
          text: 'A free toolkit used by investigators. PECmd parses Prefetch, MFTECmd reads the file table and change journal, AmcacheParser reads the program history and Registry Explorer opens registry hives.',
          looks: 'Used when the quick checks leave a question open. They produce tables with exact timestamps, which also makes it easy to show a player what was found.',
        },
        {
          name: 'Sysinternals',
          kind: 'Admin utilities',
          href: 'https://learn.microsoft.com/en-us/sysinternals/',
          text: 'Microsoft\'s own administrator tools. Autoruns shows everything that starts with Windows, TCPView lists live network connections and Strings extracts readable text from files.',
          looks: 'Used to double-check what a scanner flagged and to inspect startup entries and connections, always with the player watching.',
        },
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'commands',
      'Windows commands and what they show',
      null,
      text(
        'These are the commands a screensharer may run during a screenshare. Every command in this list **only reads** information, none of them deletes, changes or installs anything. Each one is explained so you know what is on your screen and why.',
        '',
        '> Run them yourself in a normal Command Prompt or PowerShell window to see exactly what staff see. A command marked "Needs admin" only works from an elevated window.',
      ),
      commands(
        group(
          'System and drives',
          'Command Prompt or PowerShell',
          command('systeminfo', 'Prints the Windows edition and build, the original install date, the time of the last boot, hardware details and installed updates.', 'A normal Windows edition and a plausible boot time. It shows how long the PC has been running and whether Windows is a standard release.', 'Read only'),
          command('Get-Volume', 'Lists every volume with its drive letter, file system type, label and size.', 'Which drives exist and which file systems they use, so no storage is overlooked in the check.', 'Read only'),
          command('fsutil fsinfo drives', 'Lists the drive letters the system currently knows about, including removable ones.', 'A drive that is plugged in during the session but was not part of the plan, or one that disappears halfway through.', 'Read only', 'Needs admin'),
          command('Get-PnpDevice -Class Mouse -PresentOnly', 'Lists the mice that are currently connected, with their status.', 'More than one mouse connected, which breaks the one-mouse rule, and the name of the mouse so its software can be found.', 'Read only'),
        ),
        group(
          'Processes and network',
          'Command Prompt or PowerShell',
          command('tasklist /v', 'Lists every running process with its process ID, memory use and the window title.', 'Cheat or macro programs running next to Minecraft, and processes with a hidden or odd window title.', 'Read only'),
          command('tasklist /svc', 'Shows which Windows services run inside which process.', 'A process that hosts services it should not, and confirmation that the services listed below are inside their normal processes.', 'Read only'),
          command('Get-CimInstance Win32_Process -Filter "Name=\'javaw.exe\'" | Select-Object ProcessId, CommandLine', 'Prints the exact command line Minecraft was started with, including every Java argument.', 'Unexpected `-javaagent` or similar arguments, and a launcher or path that does not match what the player says they use.', 'Read only'),
          command('netstat -ano', 'Lists open network connections with the process ID that owns each one.', 'Remote tools or unknown programs connected out, and which process owns a connection.', 'Read only'),
        ),
        group(
          'Services that must stay on',
          'PowerShell',
          command('Get-Service SysMain, PcaSvc, DPS, EventLog, Schedule, WSearch, Appinfo, DusmSvc | Format-Table Name, Status, StartType', 'Shows whether these Windows services are running and how they start. They are the services that keep the records screensharers read, such as Prefetch, program compatibility history and the event logs.', 'A service that is stopped or set to Disabled. Stopped services leave a gap in the records, which is why leaving them off is an offense under the cheating category.', 'Read only'),
          command('sc query SysMain', 'Prints the state of one service. SysMain is the service that writes the Prefetch files.', 'State `RUNNING` is normal. `STOPPED` is checked against the other services and the start type.', 'Read only'),
        ),
        group(
          'Recent activity and history',
          'Run dialog, Command Prompt or PowerShell',
          command('shell:recent', 'Opens the Recent items folder. Windows keeps a shortcut there to files you opened lately, each with its own timestamp. Type it into the Run dialog (Win + R) or the Explorer address bar.', 'Recently opened files around the time of the match, and whether the folder was emptied just before the screenshare.', 'Read only'),
          command('dir C:\\Windows\\Prefetch /o-d', 'Lists the Prefetch folder, newest first. Windows creates one entry the first time a program runs and updates it on every run.', 'Which programs were run and when, with a run count in the matching file. Names that match known cheat software are a reason to look closer.', 'Read only', 'Needs admin'),
          command('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\bam\\State\\UserSettings" /s', 'Reads the Background Activity Moderator records. They hold the last time each program was run by each user.', 'The last execution time of programs that no longer exist on disk, which can show something was run and then removed.', 'Read only', 'Needs admin'),
          command('fsutil usn queryjournal C:', 'Prints the basics of the NTFS change journal: its ID, the range of entries it holds and its size.', 'Whether the journal exists and covers the time of the match, or was recently reset.', 'Read only', 'Needs admin'),
          command('fsutil usn readjournal C: csv', 'Prints the change journal itself: every file created, renamed or deleted on the drive, with a timestamp. The output is long, so it is usually saved to a file.', 'Files created, renamed or deleted near the match or near the freeze.', 'Read only', 'Needs admin'),
          command('Get-WinEvent -FilterHashtable @{LogName=\'System\'; Id=104} -MaxEvents 5', 'Shows the latest entries of event 104, which Windows writes when an event log is cleared.', 'A cleared log close to the time of the match. An empty result is the normal case.', 'Read only'),
        ),
        group(
          'Minecraft and file checks',
          'Command Prompt or PowerShell',
          command('dir "%appdata%\\.minecraft\\logs"', 'Lists the Minecraft log files and their dates. `latest.log` holds the current session, including the mods that loaded.', 'A missing or freshly emptied logs folder, and a `latest.log` that does not match the session being played.', 'Read only'),
          command('dir "%appdata%\\.minecraft\\mods"', 'Lists the mod files with their dates and sizes.', 'Mods that are not on the allowed list, or files with a name that does not match their contents.', 'Read only'),
          command('Get-FileHash "C:\\path\\to\\file.jar" -Algorithm SHA256', 'Calculates a SHA-256 fingerprint of a file. Two identical files always give the same fingerprint, so it can be compared with a known one.', 'Whether a renamed file is really a known mod or client.', 'Read only'),
          command('Get-AuthenticodeSignature "C:\\path\\to\\file.exe"', 'Shows whether a program carries a valid digital signature and who signed it.', 'Unsigned programs in unusual places, and signatures that do not match the claimed publisher.', 'Read only'),
        ),
      ),
      text('-# The screensharer reads the output with you watching. Output that contains personal information (account names, paths with your real name) is not copied into the ticket.'),
    ),

    // ------------------------------------------------------------------------
    entry(
      'rights',
      'Player rights',
      null,
      text('These rights apply from the moment you are frozen until the ticket is closed. A screensharer who ignores one can be reported to a <@&ss-manager> in <#appeals>.'),
      terms(
        term('To know why', 'info', 'You are told what you were reported for and can see the evidence the report was based on.'),
        term('To keep control', 'info', 'You can watch everything on screen, use your own mouse and ask what any action does. You choose the permissions you give in AnyDesk.'),
        term('To decline optional tools', 'success', 'Only tools marked required are mandatory. The screensharer then has to check that part by hand.'),
        term('To privacy', 'success', 'Personal photos, documents and messages are not opened without a clear reason. If you have private items on screen, say so before the connection starts, and close them.'),
        term('To another screensharer', 'neutral', 'You can ask for a different screensharer. If nobody else takes the ticket within 10 minutes, the request counts as a refusal. You can ask for a different manager the same way, with a 3 minute limit.'),
        term('To a short break', 'neutral', 'One pause of up to 5 minutes, announced in the ticket. The session clock stops during it.'),
        term('To a guardian', 'neutral', 'Players under 18 can have a parent or guardian with them. Staff assume nobody is younger than Discord\'s minimum age.'),
        term('To a clear record', 'success', 'You get the verdict, the reason, the offense and the length in writing. The same applies to a clean verdict.'),
        term('To appeal', 'success', 'Every punishment except the unappealable ones can be appealed. See the appeals section.'),
        term('Not to be forced', 'danger', 'Nobody will make you take a screenshare. Declining has the consequences described here and no others.'),
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'limits',
      'Time limits and cooldowns',
      null,
      facts(
        ['Report window', 'Until 10 minutes after the match ends'],
        ['Show presence', '5 minutes after the freeze'],
        ['Comply with the screensharer', '10 minutes after the claim'],
        ['Typical screenshare', '20 minutes'],
        ['Maximum screenshare', '60 minutes, 90 for events'],
        ['Screensharer away', 'At most 10 minutes before connecting'],
        ['Replacement wait', '15 minutes if the screensharer must leave'],
        ['Report cooldown', '30 minutes after an unclaimed ticket'],
        ['Repeated reports', 'One per reporter per suspect per day, 4 per suspect in total'],
        ['Appeal deadline', '14 days after the punishment'],
        ['Records kept', '90 days after the ticket closes'],
        ['Charter changes', 'Announced in <#rules>, effective 48 hours later'],
      ),
      text('-# The "after match" countdown starts when the match channel closes for any reason other than inactivity, and otherwise one minute after the match ends.'),
    ),

    // ------------------------------------------------------------------------
    entry(
      'verdicts',
      'Verdicts and evidence',
      null,
      text('A verdict always comes with a written reason. The more serious the punishment, the clearer the evidence has to be.'),
      terms(
        term('Clean', 'success', 'Nothing was found, or what was found is allowed. The ticket closes and nothing is recorded against you.'),
        term('Pending', 'info', 'The evidence is unclear. You are released, the case stays open and a repeat of the same unclear signs can lead to a second look.'),
        term('Detected', 'danger', 'A cheat, a prohibited modification or a bypass was found and the evidence is shown to you. The matching offense applies.'),
        term('Admitted', 'danger', 'You told the screensharer about an advantage you use. It is treated like a detection.'),
        term('Refused', 'warning', 'You declined a required step or ended the session. The refusal offense applies.'),
        term('Force majeure', 'neutral', 'Something outside your control stopped the screenshare (a power cut, a crash that is documented). No penalty stacks and the case is looked at separately.'),
      ),
      text(
        '- A scanner result alone never decides a verdict, a person always reviews it',
        '- Evidence is kept as screenshots, hashes and the exact command output',
        '- A player who knowingly picks a lighter offense to dodge a heavier one is punished for the heavier one',
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'alternatives',
      'Lighter outcomes',
      null,
      text('For minor offenses a screensharer can choose an alternative to a ban, especially for new players and when something outside your control played a part.'),
      terms(
        term('Warning of a severed penalty', 'warning', 'You are released on the condition that the offense does not happen again. If it does, the penalty can be up to triple the normal length.'),
        term('Test result removal', 'neutral', 'The tier results you earned around the offense are removed, with no ban.'),
        term('First offense for new players', 'info', 'New members get a shorter first penalty for a minor offense, so they can read the rules. It does not stack into later ones.'),
        term('Holiday reduction', 'info', 'During public holidays, offenses caused by not being able to take a screenshare get a reduced penalty that never becomes permanent.'),
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'appeals',
      'Appeals',
      null,
      text('You can appeal any punishment from a screenshare except the unappealable ones. An appeal is judged on the charter and on the evidence, not on who is asking.'),
      steps(
        stage('Open an appeal in <#appeals>', 'Do it within **14 days** of the punishment. Say which offense you were given and why you think it is wrong, and add anything that supports you.'),
        stage('First instance', 'A senior screensharer who was not part of your screenshare reads the case. Their decision stands unless it is appealed.'),
        stage('Second instance', 'If the first appeal is denied, three senior screensharers and the original one decide by majority vote.'),
        stage('Final review', 'A <@&ss-manager> reviews only for a procedural error or evidence that was missed. The decision is final.'),
      ),
      facts(
        ['Procedural error', 'You are unbanned, or re-banned for a fairly lower penalty, and the results around the offense are reviewed'],
        ['Misinformation from staff', 'A ban that came from wrong information in a rules question is lifted'],
        ['Late appeal', 'After the 14 day deadline an appeal is only read when a force majeure can be shown'],
      ),
      text(
        '- If a decision takes longer than 24 hours, staff will tell you why',
        '- A suspect who recorded the session through a tool that is not allowed loses the appeal for that case',
        '- A suspect who was rude or abusive to a screensharer cannot appeal verbally for the length of a medium or heavier penalty',
        '- Unappealable offenses are marked on their own embed, for example bribing a screensharer',
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'privacy',
      'Data, privacy and records',
      null,
      text(
        'A screenshare looks at a PC, so how that data is handled matters as much as the check itself.',
        '',
        '- **Purpose:** the data is only used to decide the case in front of the screensharer',
        '- **Access:** only the screensharers, <@&ss-manager> and <@&creator> can see a screenshare record',
        '- **Retention:** records are deleted 90 days after the ticket closes, unless an appeal is open',
        '- **No collection:** no passwords, no personal files and no private messages are copied',
        '- **Your copy:** you can ask for the evidence in your own case, it is shared in the ticket or in your DMs',
        '- **Reuse:** screenshare evidence is never posted publicly and never used for anything else',
      ),
      facts(
        ['Records kept', '90 days after the ticket closes'],
        ['Evidence request', 'Anytime during the appeal window'],
        ['Questions about your data', '<#support>'],
      ),
    ),

    // ------------------------------------------------------------------------
    entry(
      'changes',
      'Changelog',
      null,
      facts(
        ['October 17, 2026', 'Charter 1.0: first public version of the Screenshare procedure and the punishment schedule'],
      ),
      text('-# Future versions are announced in <#rules>. The date and version at the top of this panel always match the newest entry here.'),
    ),
  ],
};
