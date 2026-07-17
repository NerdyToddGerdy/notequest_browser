# NoteQuest: Expanded World — Complete Rules Reference

Transcribed from `NOTEQUEST_EW_eng_12.pdf` (Tiago Junges, 1st Edition, Porto Alegre, 2020). This is the
authoritative source of truth for implementing a digital version of NoteQuest. It is a faithful, complete
transcription of every rule and table in the book — no interpretation or implementation notes added.

All dice are d6 unless noted. "2d6" means roll two six-sided dice; where a table lists ranges like `7-8`,
sum the two dice. Where a table is indexed by `1d6, 1d6` (two separate rolls read in order, e.g.
Prohibited Races), the first die selects a sub-table/group and the second die selects the row within it.

---

## Introduction

**NoteQuest** is a solo dungeon crawler game. It has an extremely simple and fast rules system,
prioritizing the most important and fun part: the exploration. You will play with a weak adventurer
after fame and fortune.

### How to Play

To play NoteQuest you will need this book, a notebook or grid paper, a pencil, and some dice (d6). Just
find a quiet place and start your adventure.

First you create an adventurer and a dungeon. If you manage to complete the dungeon, you can move on to
another dungeon and so on. If you die before that (very likely), create a new character and try to
explore the dungeon again (finding your old character's corpse with all the items in the backpack) or
explore a new dungeon. This is the flow of the game.

The Expanded World book contains the contents of the Core Book plus additional material: HexCrawl and
many custom dungeons, races, advanced classes, and rules for managing castles, kingdoms, and empires. It
is recommended to play the Core Book rules first before venturing into the Expanded World.

---

## Core Rules

### Creating Your Adventurer

Roll a Race and a Class on the tables below. Each indicates Hit Points (HP), an Ability, and a Starting
Weapon. You start with **10 Torches** and **no coins**. If you have spells, roll on the Basic Spells
table for each spell.

#### Table: Race (2d6)

| 2d6 | Race | HP | Ability |
|---|---|---|---|
| 2 | Slimemen | 10 | If you engulf the body of an enemy, you regain all HP. |
| 3 | Lightbugster | 16 | You start with 3 uses of the *Light* spell. |
| 4 | Pixie | 8 | You start the game with 5 random Basic Spells. |
| 5 | Gnome | 14 | You start with 3 random Basic Spells. |
| 6 | Elf | 16 | You start the game with 1 random Basic Spell. |
| 7 | Human | 20 | None. |
| 8 | Dwarf | 18 | When you roll to Find Secret Passages, roll two dice and discard the lowest. |
| 9 | Halfling | 16 | When you roll to Move Silently, roll two dice and discard the lowest. (except in the Boss!). |
| 10 | Cat-Person | 19 | You can sell equipment in the town for twice the price. |
| 11 | Rinoceroid | 24 | You can attack with your horn (Damage 1d6). |
| 12 | Dragonkin | 30 | You start with 3 uses of the *Fireball* spell. |

#### Table: Classes (2d6)

| 2d6 | Class | HP | Ability | Starting Weapon |
|---|---|---|---|---|
| 2 | Hobo | +4 | None. | Wood Stick (1d6-2 damage) |
| 3 | Grave Digger | +2 | Deal +2 damage to Undead. | Shovel (1d6-1 damage) |
| 4 | Noble | +0 | You start with 1 random Basic Spell. | Rapier (1d6+1 damage) |
| 5 | Scholar | +0 | You start with 3 random Basic Spells. | Dagger (1d6-1 damage) |
| 6 | Blacksmith | +4 | You can repair an armor by spending 1 Torch. | Hammer (1d6 damage) |
| 7 | Guard | +4 | None. | Short Sword (1d6 damage) |
| 8 | Cook | +2 | Gain 1 coin for every monster killed (except Undead). | Cleaver (1d6 damage) |
| 9 | Locksmith | +2 | You can open any door without consuming torches. | Dagger (1d6-1 damage) |
| 10 | Lumberjack | +4 | When destroying doors, roll the dice. On a 6 you get 1 torch. | Lumberjack Ax (1d6 damage) |
| 11 | Miner | +4 | If you run out of torches, you can leave the dungeon. | Pickaxe (1d6-1 damage) |
| 12 | Gladiator | +0 | None. | Short Sword (1d6 damage) |

#### Table: Spells (1d6) — "Basic Spells"

| 1d6 | Spell | Effect |
|---|---|---|
| 1 | Heal | Heals 5 HP. |
| 2 | Light | Creates a globe of light that is worth a torch (but does not use a hand). |
| 3 | Teleport | You teleport to any empty room. You can use it to escape from combat. |
| 4 | Cold Ray | Deals 4 damage to one monster and it cannot attack next turn. |
| 5 | Lightning | Deals 6 damage to one monster. |
| 6 | Fireball | Deals 5 damage to all monsters in the same room. |

### Building a Dungeon

The dungeon is built as you explore, door by door. Initially you only know its name, whispered in the
tavern. Roll three dice and look at each of the three columns to determine the Dungeon Name.

#### Table: Dungeon Name (1d6 per column)

| 1d6 | First Part (Dungeon Type) | Second Part | Third Part |
|---|---|---|---|
| 1 | The Palace (page 12) | ... of the Secret ... | ... Horrors |
| 2 | The Crypt (page 14) | ... of the Broken ... | ... Curse |
| 3 | The Tomb (page 16) | ... of the Eternal ... | ... Rest |
| 4 | The Sanctuary (page 18) | ... of the Cold ... | ... Hero |
| 5 | The Temple (page 20) | ... of the Flaming ... | ... Vow |
| 6 | The Prison (page 22) | ... of the Dying ... | ... Darkness |

Depending on the Dungeon Type, you look for the tables on the corresponding page — you only need the
tables that exist for that dungeon type.

### Opening Doors

Each time you find a door, roll on the table below to find out what happens. If a trap activates, roll
on the Trap table for the current dungeon type.

#### Table: Open a Door (1d6)

| 1d6 | What happens? |
|---|---|
| 1 | You activate a Trap! |
| 2 | Locked! |
| 3 | Locked! |
| 4 | Unlocked |
| 5 | Unlocked |
| 6 | Unlocked |

### Segments

The dungeon map is separated into "Segments," where a Segment can be a Corridor, Staircase, or Room.
Whenever you open a door, roll a die and check the corresponding column in that dungeon's **Segments**
table based on where you are opening the door:

- On a **Staircase**: check the "Open from a Staircase" column.
- In a **Corridor**: check the "Open from a Corridor" column.
- In a **Room**: check the "Open from a Room" column.

If the resulting segment is a Room, also roll on the **Content** table and the **Monsters** table for
that dungeon.

### The Final Room

Each staircase descended takes you to a new level. As soon as you enter the third level (i.e., there are
2 floors between you and the dungeon entrance), you have found the Final Room.

If the dungeon was completed without any stairs, the last open room is the Final Room.

The Final Room is a large room with no doors where the Boss of the dungeon waits in the center. Roll
only the *Dungeon Boss* table on the dungeon's page and nothing else (no Content or Monsters roll).
After defeating the Dungeon Boss you find 2d6 Treasures.

### The Darkness

The Darkness is your adventurer's greatest enemy. If at any time you are in the middle of the dungeon
without a torch, the darkness will devour you. You lose your character and must make a new one. When the
new character arrives where the old one died, he will find his backpack and clothes on the floor.
Monsters are unaffected by darkness.

Each torch spent reflects an action that took time. If you are running out of torches, you can go into
town to buy more. Each Torch costs 1 coin, but you can only carry a maximum of 10 torches at a time.

### Spending Torches

The most important resource for dungeon exploration is Torches. Every character starts with 10 torches.
Entering a dungeon consumes 1 torch to light the way. Some actions, such as *Open Lock* and *Find Secret
Passages*, take time and may consume more torches.

### Dungeon Actions

Inside the dungeon, you walk from segment to segment. If you enter a segment with monsters, you must
face them before anything else. If there are no monsters (or they've been defeated), you can open doors
or chests that exist there.

Special actions the player can choose:

- **Open Lock**: Spend 1 torch and unlock a locked door.
- **Breaking the Door**: A locked door can be opened by breaking. This is simple and does not require a
  roll or torch; however, doing this means the door can no longer be closed, and it alerts all monsters
  of that segment, who will attack you first.
- **Move Silently**: If you opened a door without breaking it or activating a trap, you can choose to
  Move Silently. Spend 1 torch and roll a die for each monster inside the room; if any die results in a
  1, the monsters see you and attack first. If successful, you go through the room undetected, picking
  up treasures and opening doors. If while hiding you set off a trap or make a noise, monsters attack.
  You cannot Move Silently in the Dungeon Boss's room.
- **Disarm Traps**: In a room, spend 1 torch to prevent any trap inside that room from taking effect.
- **Find Secret Passage**: If you are on a segment that may have a Secret Passage, spend 1 torch and roll
  on the Secret Passage table.
- **Open a Chest**: If you find a Chest, roll two dice. The die with the highest result indicates how
  many coins were in the chest, and the die with the lowest result indicates how many Treasures were in
  the chest. However, if both dice show 1, the chest was empty and activated a Trap!

### City Actions

When you need to leave the dungeon (torches running low, low HP), make sure the segments up to the
entrance are empty. In the city you can do:

- **Rest**: Spend 1 coin and recover your HP and spells consumed.
- **Fix Armor**: Spend 1 coin to recover HP of an armor.
- **Buy Torches**: Spend 1 coin and add 1 torch. Max 10 torches carried at a time.
- **Sell Items**: Sell any item in any city for 1 coin. Magic items sell for 1d6-1 coins.

### Special Conditions

- **Spells**: Each spell has a different effect and can be used outside or inside combat. In combat it
  consumes an attack turn. After use, the spell is worn out and can only be used again once recovered in
  the city. You can have the same spell more than once (more uses).
- **Load Limit**: You can carry up to 10 torches, and up to 10 items in your backpack.
- **Armor**: Armor is separated into 5 pieces: Shoulderpads, Bracelets, Boots, Helmet, and Breastplate.
  You can use any pieces as you like, but can't use more than one identical piece. Each piece has an HP
  value; if a piece of armor loses all HP, it is destroyed.
- **Broken Doors**: Whenever you have a broken door in a segment, there is communication between the
  segments. If monsters in one segment are alerted, monsters in the other segment are also alerted and
  will attack you.
- **Keys and Doors**: If you find a key, you can open any door in the dungeon. Keys found in one dungeon
  do not open doors in another. The *Master Key* opens any door in any dungeon.
- **Returning to a Dungeon**: If you leave the dungeon to rest in the city, when you return you must roll
  on the Monster table for each empty room you enter. This is also true if you die and venture out with
  another character in the same dungeon. If a room still has monsters, they recover all their health.

### Combat

Combat is simple. First determine who starts attacking: if you opened the door without making a sound
(i.e., without destroying it or activating a trap), you start attacking. Otherwise, the monsters attack
first. Combat then rotates attacks between you and the monsters.

When monsters attack, add up everyone's damage and reduce this value from your HP (or armor's HP, if
you're using one — your call). On your turn, roll the damage of the weapon you are using, choose an
enemy, and reduce its HP.

If you lose all HP, your character is dead and all your equipment will be on the floor of that room to
be recovered by your next character.

### Your Hands

When exploring a dungeon, one hand must hold the torch, so you cannot fight with a Two-Handed weapon
without another source of light in place. Losing an arm in a trap has the same effect. Ways around this:
hiring someone to hold the torch (see Hireling), using a lamp, or casting Light spells.

### Monsters — Special Abilities

Some monsters have unique characteristics:

| Ability | Effect |
|---|---|
| Stoneskin | This monster ignores any damage taken that is 3 or less. |
| Loot | After the fight, roll 1d6. On a 6 you found 1 Treasure. On a 5 you found 1 Key. If 4 or less you found 1 coin. |
| Explosive | When you get a 1 on the damage roll, this monster destroys itself and deals damage equal to its current HP. |
| Firebreath | When you get a 1 on the damage roll, its next attack will deal +10 damage. |
| Horde | When you get a 1 on the damage roll, an Orc (6 HP; Damage 3) enters the room. |
| Intangible | Takes no damage if the damage is an even number. |
| Sorcery | When you get a 1 on the damage roll, this monster will cast a spell. Roll 1 die and add up the final damage value of the monster's next attack. |
| Deathtouch | When you get a 1 on the damage roll, this monster's next attack will kill you. |
| Undead | After this monster is defeated, roll a die. If it's a 1, this monster comes back to life with 1 HP. |
| Necromancy | When you get a 1 on the damage roll, a Skeleton (4 HP; Damage 1; Undead) appears. |
| Weakness | When you get a 6 on the damage roll, this monster takes twice as much damage. |
| Regeneration | When you get a 1 on the damage roll, this monster recovers 6 HP. |
| Paralyze | When you get a 1 on the damage roll, the next attack paralyzes for 1d6 turns. |
| Poison | All damage from this creature cannot be absorbed by armor or other means. |

---

## Basic Dungeons

Each dungeon type has its own set of tables: Segments, Secret Passage, Trap, Room Content, Monsters,
Reward, Boss, Armor, and Weapon. All six basic dungeon types share the *same* Segments and Secret
Passage table shapes (reproduced per-dungeon below since the book repeats them per section).

### Palace (page 12)

This dungeon is inside a large building with a beautiful entrance door. In the past this was the home of
some nobleman. When you open the door you find a giant hall with two doors on each side and a staircase
in the center. At the end of the staircase there is a wooden door.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Small room with another door. |
| 2 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 3 | Corridor with two other doors. | Wide room with another door. | Medium size room. |
| 4 | Corridor with two other doors. | Wide room with two other doors. | Wide room. |
| 5 | Corridor with three other doors. | Large room with two other doors. | Large room with pillars. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | There's nothing here. |
| 4 | You have found a hidden Chest! |
| 5 | You have found a hidden Chest! |
| 6 | A secret door to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | Acid Spout (5 Damage). |
| 3 | You fall into a ditch (spend 1 torch to go out). |
| 4 | A dart hits you (1 Damage). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Dust-filled library. It may have Secret Passage. |
| 3 | Destroyed kitchen with 1d6 coins on the floor. |
| 4 | Large table with a few chairs. It may have Secret Passage. |
| 5 | Bookshelf with 1d6 Magic Scrolls. |
| 6 | Desk with a Chest. |
| 7 | Dirt everywhere. It may have Secret Passage. |
| 8 | Bed with a Chest on the side. |
| 9 | Garden covered by plants. It may have Secret Passage. |
| 10 | Trash deposit. It may have Secret Passage. |
| 11 | Large table with papers and maps. It may have Secret Passage. |
| 12 | Armory. 2d6 Magic Items. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Minotaur (14 HP; 7 Damage) |
| 3 | 2 Orcs (6 HP; 3 Damage; Loot) |
| 4 | 1 Orc (6 HP; 3 Damage; Loot) |
| 5 | 1d6 Giant Rats (2 HP; 1 Damage) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 2 Living Armor (8 HP; 3 Damage) |
| 10 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 11 | Bone Golem (12 HP; 5 Damage; Undead) |
| 12 | Walking Slime (10 HP; 1 Damage; Loot; Regeneration) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Ornament (worth 5 Coins in the town) | Jester Hat (2 HP; Can't Move in Silence) | [Armor] of Royalty (It is very elegant) |
| 2 | Health Potion (Recovers all HP) | Emperor's Sandals (2 HP; +1 dmg against cockroaches) | Leprechaun's [Armor] (Earn double coins in chests) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Amulet of the Dead (Ignores Undead effect) | Centurion's [Armor] (+1 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Potion of Luck (Ignores the next activated Trap) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Potion of Fury (Damage +2 until the end of the fight) | [Weapon] of War (Deals +2 damage to Angels) |
| 6 | [Roll in the "Magic Item" column] | Lamp (No need to use hands to light) | [Weapon] of the Dragon Slayer (Double damage against Dragons) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Walking back and forth is the Zombie Baron (30 HP; 4 Damage; Undead). |
| 2 | Sitting on his old and dusty throne is the Mad King (22 HP; 2 Damage; Explosive). |
| 3 | This was a luxurious room, now is covered in dust. There, the Ghost Lady (13 HP; 3 Damage; Intangible) awaits you. |
| 4 | Around a throne are 2 Unholy Gargoyles (12 HP; 3 Damage; Stoneskin). |
| 5 | Sewing a corpse on a table is the Necromancer (16 HP; 7 Damage; Necromancy). |
| 6 | Sitting on a throne and with one foot on a dragon skull is the Orc King (24 HP; 5 Damage; Horde). |

**Table: Armor (1d6)**

| 1d6 | Armor |
|---|---|
| 1 | Ring (0 HP) |
| 2 | Bracelets (2 HP) |
| 3 | Boots (3 HP) |
| 4 | Shoulderpads (3 HP) |
| 5 | Helm (4 HP) |
| 6 | Breastplate (10 HP) |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Candlestick (1d6-1 Damage) |
| 2 | Sword (1d6 Damage) |
| 3 | Rapier (1d6+1 Damage) |
| 4 | Whip (1d6+1 Damage) |
| 5 | Claw (1d6+1 Damage) |
| 6 | Halberd (1d6+3 Damage; Two-handed) |

### Crypt (page 14)

This dungeon is hidden inside a small isolated mausoleum in the middle of nowhere. It is covered by
cobwebs and inscriptions of names long forgotten. Inside there is a staircase that leads down. At the end
of the staircase there is a door.

Segments and Room Content categories share the same shape as Palace's tables (see structure above); full
values below.

**Table: Segments (1d6)** — identical to Palace's Segments table.

**Table: Secret Passage (1d6)** — identical to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | Acid Spout (5 Damage). |
| 3 | Appears 1d6 Bats (1 HP; 1 Damage; Poison). |
| 4 | You hear a click, but nothing happens. |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Tombstone carved with your name. |
| 3 | Several pots with dead plants. |
| 4 | Texts sculpted on the floor. It may have Secret Passage. |
| 5 | Human bones everywhere. It may have Secret Passage. |
| 6 | A pile of bones and 1d6 coins. |
| 7 | Casket with Chest inside. |
| 8 | Various wooden coffins. It may have Secret Passage. |
| 9 | Walls made of skulls. It may have Secret Passage. |
| 10 | Dozens of burned candles everywhere. It may have Secret Passage. |
| 11 | Broken statue of a forgotten person. It may have Secret Passage. |
| 12 | Treasure room with 2d6 Treasures. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Vampire Servant (9 HP; 4 Damage; Regeneration) |
| 3 | Giant Leech (12 HP; 5 Damage) |
| 4 | 3 Skeletons (4 HP; 1 Damage; Undead) |
| 5 | Ghoul (6 HP; 3 Damage; Regeneration) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 1d6 Bats (1 HP; 1 Damage; Poison) |
| 10 | Giant Spider (10 HP; 4 Damage; Paralyze) |
| 11 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 12 | 2 Giant Spiders (10 HP; 4 Damage; Paralyze) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Religious Object (worth 3 Coins in the town) | Garlic necklace (+1 against Vampire and Ghoul) | [Armor] of the Dead (It always stinks) |
| 2 | Health Potion (Recovers all HP) | Potion of Luck (Ignores the next activated Trap) | [Armor] of the Spider Queen (ignores the effect Paralyze) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Potion of Fury (Damage +2 until the end of the fight) | Count's [Armor] (+2 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Salamander Potion (Recovers lost arm) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Master key (Open any door) | Vampiric [Weapon] (Recovers 1 HP with each attack) |
| 6 | [Roll in the "Magic Item" column] | Potion of Luminescence (Worth like two torches) | Boatman's Oar (1d6+1 Dmg; ignores Intangible) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | The room is covered with cobwebs. In the center of the web is the Spider Queen (20 HP; 3 Damage; Paralyze). |
| 2 | In the center of the room is a large mass of mucus that writhes to form the Death Dessert (30 HP; 2 Damage). |
| 3 | The sinister figure in the center of the room carries an oar. He is the Death Boatman (20 HP; 2 Dmg; Deathtouch). |
| 4 | In the center of the room is an open coffin and the Master Vampire (20 HP; 5 Dmg; Regeneration) is waking up. |
| 5 | This room is covered by war banners. In the center is the ghost of the Eternal Warrior (10 HP; 5 Dmg; Intangible). |
| 6 | Trapped by several chains inside the room, the Vampiric Beast (19 HP; 7 Dmg) squirms with rage. |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Femur (1d6-1 Damage) |
| 2 | Pickaxe (1d6 Damage) |
| 3 | Dagger (1d6 Damage) |
| 4 | Warhammer (1d6+1 Damage) |
| 5 | Sickle (1d6+1 Damage) |
| 6 | Glaive (1d6+2 Dmg; Two-handed) |

**Table: Armor (1d6)** — identical shape to Palace's Armor table (Ring 0/Bracelets 2/Boots 3/Shoulderpads 3/Helm 4/Breastplate 10).

### Tomb (page 16)

This dungeon was built inside an immense and imposing stone structure. Someone very important was buried
here. Pillars and statues adorn the place. In front of you is a large stone door. Behind it, a long
corridor with a door at the end and two other doors on the sides.

**Table: Segments (1d6)** — identical to Palace's Segments table.

**Table: Secret Passage (1d6)** — identical to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead). |
| 3 | Raise 1d6 Skeleton Soldiers (4 HP; 2 Damage; Undead). |
| 4 | Raise 1 Skeleton (3 HP; 1 Damage; Undead). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Empty sarcophagus with your name. |
| 3 | Several pots with dead plants. |
| 4 | Texts sculpted on the floor. It may have Secret Passage. |
| 5 | Human bones everywhere. It may have Secret Passage. |
| 6 | Pile of bones and 1d6 coins. |
| 7 | Sarcophagus with Chest inside. |
| 8 | Several wooden coffins. It may have Secret Passage. |
| 9 | Walls made of skulls. It may have Secret Passage. |
| 10 | A destroyed sarcophagus. It may have Secret Passage. |
| 11 | Broken statue of a hero. It may have Secret Passage. |
| 12 | Treasure Room with 2d6 Treasures. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Ghost of the Prince (6 HP; 4 Damage; Intangible) |
| 3 | Bone Golem (12 HP; 5 Damage; Undead) |
| 4 | 2 Skeleton Soldiers (4 HP; 2 Damage; Undead) |
| 5 | 1 Living Armor (8 HP; 3 Damage) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 1d6 Scorpions (2 HP; 1 Damage; Poison) |
| 10 | 2 Living Armor (8 HP; 3 Damage) |
| 11 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 12 | Giant Spider (10 HP; 4 Damage; Paralyze) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Mana Potion (Recovers all Spells) | Crown of the beheaded prince (Does not die in blade traps) | Bone [Armor] (-1 HP) |
| 2 | Health Potion (Recovers all HP) | Potion of Luck (Ignores the next activated Trap) | [Armor] of Strength (+1 HP) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Potion of Luck (Ignores the next activated Trap) | [Armor] of the Special Guard (+1 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Potion of Fury (Damage +2 until the end of the fight) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Sapphire of Magic (Learn a random Spell) | Vampiric [Weapon] (Recovers 1 HP with each attack) |
| 6 | [Roll in the "Magic Item" column] | Lamp (No need to use hands to light) | Vorpal [Weapon] (Kills instantly when get '6' on the die) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Greenish cloud covers the room. Lying on an altar is the Emperor Scorpio (20 HP; 3 Damage; Poison). |
| 2 | On a great throne is the giant skeleton of the Skeleton King (12 HP; 7 Damage; Undead). |
| 3 | Floating on an altar is the Queen of Bladed Hands (11 HP; 10 Damage). |
| 4 | Flying around your sarcophagus is the Ghost King of the Lost Swamp (10 HP; 4 Damage; Intangible). |
| 5 | In this room are the walking skeletons of the Seven Necrotic Kings (4 HP; 1 Damage; Undead). |
| 6 | From inside a sarcophagus comes the Lich King of the Ethernal Wars (22 HP; 6 Damage; Necromancy, Undead). |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Shovel (1d6-1 Damage) |
| 2 | Sword (1d6 Damage) |
| 3 | Axe (1d6+1 Damage) |
| 4 | Warhammer (1d6+1 Damage) |
| 5 | Sickle (1d6+1 Damage) |
| 6 | Scythe (1d6+2 Dmg; Two-handed) |

**Table: Armor (1d6)** — identical shape to Palace's Armor table.

### Sanctuary (page 18)

A small abandoned chapel in the middle of nowhere. Its entrance is guarded by statues of faceless angels.
Inside, there is only a stone altar and a wooden trapdoor on the floor that has already been destroyed.
Opening the trapdoor you can see a dark staircase. At the end of the staircase there is a door.

**Table: Segments (1d6)** — identical to Palace's Segments table.

**Table: Secret Passage (1d6)** — identical to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | Spears come out of the ground (5 Damage). |
| 3 | You fall into a ditch (spend 1 torch to go out). |
| 4 | You hear a click, but nothing happens. |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | A magic circle on the floor. (works as a Portal; see in the expansion). |
| 3 | 10 chairs lined up. |
| 4 | Torture Room with 1d6 Treasures. |
| 5 | Creature or deity statues. It may have Secret Passage. |
| 6 | Corpse with 1 Treasure. |
| 7 | Large Chest on an altar. |
| 8 | Small altar with 1d6 coins. It may have Secret Passage. |
| 9 | 2d6 paintings of gods (2 coins each). It may have Secret Passage. |
| 10 | Melted candles everywhere. It may have Secret Passage. |
| 11 | Fountain with running water. It may have Secret Passage. |
| 12 | Shelves with 1d6 Treasures. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | 8 Wisp (2 HP; 1 Damage) |
| 3 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 4 | 3 Warrior Angels (4 HP; 2 Damage) |
| 5 | Sentinel Angel (5 HP; 3 Damage; Sorcery) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 2 Orcs (6 HP; 3 Damage; Loot) |
| 10 | Giant Angel Statue (10 HP; 5 Damage; Stoneskin) |
| 11 | Giant Spider (10 HP; 4 Damage; Paralyze) |
| 12 | Fallen Angel of Putrification (21 HP; 4 Damage; Poison) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Religious Object (worth 3 Coins in the town) | Protector Candle (Discard and next chest will be double) | Priest's [Armor] (Covered by religious symbols) |
| 2 | Health Potion (Recovers all HP) | Blessed Potion (Destroy a cursed item) | [Armor] of the Gods (ignore Deathtouch) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Potion of Luck (Ignores the next activated Trap) | Angelic [Armor] (+2 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Potion of Fury (Damage +2 until the end of the fight) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Master key (Open any door) | Vampiric [Weapon] (Recovers 1 HP with each attack) |
| 6 | [Roll in the "Magic Item" column] | Potion of Luminescence (Worth like two torches) | Vorpal [Weapon] (Kills instantly when get '6' on the die) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | At six meters high, the Rat God (30 HP; 5 Damage; Poison) is waiting for you there with his giant mace. |
| 2 | Around a large sarcophagus covered with runes are the 2 Nether Guardians (9 HP; 3 Damage; Intangible). |
| 3 | Wrapped in mucus and pieces of living human bodies is the terrible Aberration (29 HP; 4 Damage; Weakness). |
| 4 | A light from above illuminates the room. From this light emerges the Faceless Goddess (40 HP; 7 Dmg; Sorcery). |
| 5 | A light from above illuminates the room. From this light emerges the God of Destruction (40 HP; 8 Dmg). |
| 6 | In the center of the room, surrounded by lit candles, is the Fallen Angel of Vengeance (25 HP; 8 damage; Sorcery). |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Pan (1d6-1 Damage) |
| 2 | Machete (1d6 Damage) |
| 3 | Sword (1d6+1 Damage) |
| 4 | Warhammer (1d6+1 Damage) |
| 5 | Mace (1d6+1 Damage) |
| 6 | Scythe (1d6+3 Damage; Two-handed) |

**Table: Armor (1d6)** — identical shape to Palace's Armor table.

### Temple (page 20)

A beautiful structure stands among the plants and trees of the place. Its architecture is incredible and
its walls are covered with strange inscriptions. The entrance is a large stone door. Behind it, an empty
corridor with four more doors (two on each side).

**Table: Segments (1d6)** — identical to Palace's Segments table.

**Table: Secret Passage (1d6)** — identical to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | A giant hammer comes out of the ceiling (5 Dmg). |
| 3 | You fall into a ditch (spend 1 torch to go out). |
| 4 | A dart hits you (1 Damage). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | A magic circle on the floor. (works as a Portal; see in the expansion). |
| 3 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) — *(note: this row is listed under Monsters, see below; Room Content row 3 is "Bottomless pit.")* |
| 4 | Torture Room with 1d6 Treasures. |
| 5 | Unknown creature statues. It may have Secret Passage. |
| 6 | Corpse with 1 Treasure. |
| 7 | Chest surrounded by melted candles. |
| 8 | Small altar with 1d6 coins. It may have Secret Passage. |
| 9 | 2d6 paintings of demons (1 coin each). It may have Secret Passage. |
| 10 | Carcasses of giant snakes. It may have Secret Passage. |
| 11 | Dry fountain. It may have Secret Passage. |
| 12 | Desk with 1d6 Treasures in the drawers. |

> Note: row 3 of Room Content is "Bottomless pit." per the book; the Monsters table's row 3 is "3 Fungoid" — these are separate tables, both correctly listed below.

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | 2d6 Imps (2 HP; 1 Damage) |
| 3 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 4 | 1d6 Cultists (4 HP; 1 Damage) |
| 5 | 1d6 Serpents (2 HP; 1 Damage; Poison) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 2 Orcs (6 HP; 3 Damage; Loot) |
| 10 | Serpent Golem (10 HP; 5 Damage; Poison) |
| 11 | Giant Serpent (17 HP; 3 Damage; Paralyze) |
| 12 | Gargoyle (12 HP; 3 Damage; Stoneskin) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Sinister Idol (worth 3 Coins in the town) | Potion of the Color That Came from Beyond (Hair gets a random color) | Cultist's [Armor] (Discard to ignore a Trap) |
| 2 | Health Potion (Recovers all HP) | Potion of Luck (Ignores the next activated Trap) | Scaled [Armor] (+1 Damage against Snakes) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Potion of Fury (Damage +2 until the end of the fight) | Infernal [Armor] (+3 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Potion of the Helping hand (Creates a new arm) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Master key (Open any door) | Cosmic [Weapon] (On a '1' it opens a Portal) |
| 6 | [Roll in the "Magic Item" column] | Sapphire of Magic (Learn a random Spell) | Vorpal [Weapon] (Kills instantly when get '6' on the die) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | From a large gap in the center of the room, comes the great Tentacle God (20 HP; 6 Damage; Regeneration). |
| 2 | The pile of cultists' bodies ends up welding and forming the Bloody Beast (23 HP; 4 Damage; Weakness). |
| 3 | Inside the empty room is just a small kitten. But make no mistake, this is the Meow Horror (40 HP; 2 Dmg). |
| 4 | There are three giant statues. Their eyes open and reveal themselves as the Three Watchers (10 HP; 3 Damage). |
| 5 | Arising from the fires of hell, the Demon Lord (30 HP; 6 Damage; Firebreath) wants to take your soul. |
| 6 | Covering the room with its snake-like body, the Serpent God (30 HP; 3 Damage; Poison) was waiting for you. |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Hacksaw (1d6-1 Dmg) |
| 2 | Saber (1d6 Dmg) |
| 3 | Kukri (1d6 Dmg) |
| 4 | Scimitar (1d6+1 Dmg) |
| 5 | Mace (1d6+1 Dmg) |
| 6 | Sword (1d6+1 Dmg) |

**Table: Armor (1d6)** — identical shape to Palace's Armor table.

### Prison (page 22)

The entrance to this dungeon is hidden under the ruins of an old abandoned castle. Behind a pile of
rubble is a reinforced trap door. Upon opening it, it is possible to see a large staircase down. At the
end of the staircase there is a door.

**Table: Segments (1d6)** — identical to Palace's Segments table.

**Table: Secret Passage (1d6)** — identical to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade falls from the ceiling. Roll the dice. On a 2 you lose one of your arms and on a 1 you die. |
| 2 | Stones collapse from the ceiling (5 Damage). |
| 3 | You fall into a ditch (spend 1 torch to go out). |
| 4 | A dart hits you (1 Damage). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | A cell with the skeleton of a childhood friend. It may have Secret Passage. |
| 3 | Large table with papers and confessions signed in blood. |
| 4 | Six cages hanging on the ceiling. It may have Secret Passage. |
| 5 | Shelf of belongings with 1d6 Treasures. |
| 6 | Shackles on the walls and hanging bones. |
| 7 | Four empty cells. It may have Secret Passage. |
| 8 | Large cell with bones on all sides. |
| 9 | Torture bed. It may have Secret Passage. |
| 10 | Stack of coffins. |
| 11 | Slime covered wall. It may have Secret Passage. |
| 12 | Arsenal. 2d6 Magic Items. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Cave Troll (26 HP; 6 Damage; Regeneration) |
| 3 | Orc Leader (10 HP; 3 Damage; Loot; Horde) |
| 4 | 2 Orcs (6 HP; 3 Damage; Loot) |
| 5 | 1 Orc (6 HP; 3 Damage; Loot) |
| 6 | 1d6 Goblins (3 HP; 1 Damage; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | 2 Living Armor (8 HP; 3 Damage) |
| 10 | 3 Fungoid (4 HP; 2 Damage; Loot; Regeneration) |
| 11 | Golem Ossos (12 HP; 5 Damage; Undead) |
| 12 | Giant Magic Turtle (30 HP; 2 Damage; Sorcery) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Health Potion (Recovers all HP) | Goblin Whistle (Goblins flee on hearing) | [Armor] of the Goblin Hero (-2 HP) |
| 2 | Magic Scroll (Random Basic Magic; Use once) | Potion of Luck (Ignores the next activated Trap) | [Armor] of Strength (+1 Damage) |
| 3 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Potion of Fury (Damage +2 until the end of the fight) | Elven [Armor] (+2 HP) |
| 4 | [Roll in the "Weapon" table] | Salamander Potion (Recovers lost arm) | [Weapon] of Destruction (Deals +2 damage) |
| 5 | [Roll in the "Wonders" column] | Master key (Open any door) | [Weapon] of the Dragon (Ignores the effect Firebreath) |
| 6 | [Roll in the "Magic Item" column] | Lamp (No need to use hands to light) | Vorpal [Weapon] (Kills instantly when get '6' on the die) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | All furniture is charred. In the middle of the room is the Fire Serpent (20 HP; 3 Damage; Firebreath). |
| 2 | Goblin bodies cover the floor and in the center is the Deadly Stinger Giant Wasp (22 HP; 4 Damage; Poison). |
| 3 | Statues everywhere. With an evil smile, the 2 Hell Hounds (10 HP; 3 Damage; Firebreath) were waiting for you. |
| 4 | Statues everywhere. With an evil smile, the Medusa (20 HP; 4 Damage; Paralyze) was waiting for you. |
| 5 | You see the Cursed Ogre (20 HP; 7 Damage; Weakness) destroying all the furniture in the room. |
| 6 | In the center of the room is a huge and scary Dragon (28 HP; 7 Damage; Firebreath). |

**Table: Armor (1d6)** — identical shape to Palace's Armor table.

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | BBQ Stick (1d6-2 Dmg) |
| 2 | Machete (1d6 Damage) |
| 3-4 | Spear (1d6+1 Damage) |
| 5-6 | Lance (1d6+2 Damage; Two-handed) |

---

## The Graveyard

Write down the characters that died trying to explore these dungeons, in a table with columns: **Name**,
**Dungeon**, **Cause of Death**. (This is a blank play-sheet in the book, repeated at the end of the
Expanded World section too.)

---

## Expanded World

The Expanded World book contains all the content above (Core Book) plus HexCrawl exploration, additional
dungeon types, races, advanced classes, and rules for managing castles, kingdoms, and empires.

### Hexploring the World

These rules allow a new game mode. It's recommended to play the basic mode before venturing out into the
world.

#### Provisions

Your character starts with 20 provisions and can buy more in any city by paying 1 coin per Provision, up
to a maximum of 20. No one can carry more than 20 provisions. Every day of travel consumes 1 Provision —
this is also a resource that measures travel time. If you run out of provisions and have to move, lose 1
HP for each provision needed.

#### Drawing the Map

You need a sheet with a hexagonal grid. Draw hexagons to demarcate locations and terrain types.

#### Walking Around

You move hexagon by hexagon. Travel time depends on the terrain type being entered: Plains take 1 day
(1 provision); Mountains take 3 days (3 provisions); any other land type takes 2 days (2 provisions). It
is not possible to move on water without a boat.

When entering a hex, first determine the neighboring hexes. Roll one die in the Terrain table for each
hex. After that, roll one more die for each hex to see if there is a location. If it lands on 6, there is
a location — roll on the Location table.

**Table: Terrain (Hot climate) (1d6)**

| 1d6 | Plain | Mountain | Forest | Swamp | Desert | Water |
|---|---|---|---|---|---|---|
| 1 | Water | Desert | Water | Water | Desert | Water |
| 2 | Mountain | Mountain | Swamp | Water | Desert | Water |
| 3 | Forest | Mountain | Mountain | Forest | Swamp | Water |
| 4 | Plain | Forest | Forest | Forest | Swamp | Mountain |
| 5 | Plain | Forest | Forest | Swamp | Mountain | Swamp |
| 6 | Plain | Plain | Plain | Swamp | Mountain | Plain |

**Table: Terrain (Cold climate) (1d6)**

| 1d6 | Plain | Mountain | Forest | Glacier | Tundra | Water |
|---|---|---|---|---|---|---|
| 1 | Water | Tundra | Water | Water | Water | Water |
| 2 | Glacier | Mountain | Glacier | Water | Tundra | Water |
| 3 | Mountain | Mountain | Mountain | Water | Tundra | Water |
| 4 | Forest | Forest | Forest | Glacier | Tundra | Water |
| 5 | Tundra | Forest | Forest | Mountain | Glacier | Water |
| 6 | Plain | Plain | Forest | Glacier | Mountain | Plain |

**Table: Location (1d6, by land)**

| 1d6 | Plain | Mountain | Forest | Water |
|---|---|---|---|---|
| 1 | Orc City | Orc Fortress | Goblin City | Rocks |
| 2 | Goblin City | Orc City | Goblin City | Rocks |
| 3 | Ruins | Ruins | Ruins | It was nothing... |
| 4 | Human City | Volcano | Gnome City | It was nothing... |
| 5 | Human City | Dwarven City | Elven City | Reef |
| 6 | Human Fortress | Dwarven Fortress | Elven Fortress | Reef |

| 1d6 | Swamp | Desert | Glacier | Tundra |
|---|---|---|---|---|
| 1 | Orc City | Orc City | Thin Ice | Orc City |
| 2 | Goblin City | Oasis | Thin Ice | Ruins |
| 3 | Portal | Oasis | Thin Ice | Ruins |
| 4 | Portal | Oasis | Portal | Ruins |
| 5 | Portal | Portal | Portal | Portal |
| 6 | Human City | Human City | Portal | Human City |

Location notes:
- **City**: In the city you can discover dungeons and perform various actions.
- **Fortress**: Like the city but with more options.
- **Ruins**: Explore as if it were a dungeon.
- **Reef**: Upon entering, roll 1d6. If 1, your ship ran aground (lose 1 provision). If 3 or more you found
  an Underwater Cave (page 62).
- **Thin Ice**: Upon entering this hex, roll 1d6. If 1 you fell into the freezing water and died.
- **Volcano**: Has a Volcanic Cave (page 62).
- **Oasis**: Roll 1d6. If 4 or less, it was a mirage. If 5 or 6, you found an Oasis (recover all lost HP).
- **Portal**: You can enter the portal (see below).
- **Rocks**: It is not possible to pass here.

#### Events on Travel

Whenever you enter a hex that doesn't have a location, roll 2d6. If it's 7 or more, nothing happened. If
not, you have found an Event.

**Table: Events**

| Terrain | Result 2 | Result 3 or 4 | Result 5 or 6 |
|---|---|---|---|
| Water | Kraken (50 HP; 10 dmg) | 4 pirates (5 HP; 2 dmg; Loot) | Storm (Move to a random hex) |
| Plain | Wyvern (12 HP; 6 dmg; Firebreath) | Orc (6 HP; 3 dmg; Loot) | Heavy rain (loses 1 provisions) |
| Mountain | Dragon (30 HP; 7 dmg; Firebreath) | 2 Orcs (6 HP; 3 dmg; Loot) | Avalanche (lose 2 HP) |
| Forest | Troll (10 HP; 6 dmg; Regen) | 1d6 Goblins (3 HP; 1 dmg; Explo.) | Heavy rain (loses 1 provisions) |
| Swamp | Moss Giant (20 HP; 2 dmg) | Heavy rain (loses 1 provisions) | Storm (Move to a random hex) |
| Desert | Giant Worm (30 HP; 10 dmg) | Sand Storm (loses 1 prov.) | Sand Storm (loses 1 prov.) |
| Tundra | Yeti (20 HP; 5 dmg) | Blizzard (lose 2 provisions) | Blizzard (lose 2 provisions) |
| Glacier | Cracked Ice (You died!) | Cracked Ice (You died!) | Blizzard (lose 2 provisions) |

*Creatures with Loot will have 1d6-1 coins.

### Cities and Fortresses

When you are in a city or fortress you can do these actions:

- **Rest**: Spend 1 coin and recover all your HP and spells consumed.
- **Fix**: Spend 1 coin to recover all HP from an armor.
- **Buy**: Spend 1 coin and add 1 torch or 1 provision. Max 10 torches and 20 provisions carried.
- **Sell**: Sell any item in any city for 1 coin. Magic items sell for 1d6-1 coins. If it is a Fortress,
  double this value.
- **Ask**: You can ask where the nearest dungeon to town is (see below).
- **Hire Boat**: If you are in a city or fortress beside a water terrain, spend 1 coin and go on water
  terrain. You travel normally but once you enter non-water terrain you leave the boat.

#### Different Cultures

In addition to the actions above, each city has an extra action depending on the race of the location:

- **Human**: Can eliminate a Curse or Cursed Item for 200 coins.
- **Dwarf**: You can buy a Lamp for 40 coins. With the lamp you can use both hands in combat.
- **Elf**: You can buy a pair of Elven Boots (2 HP) for 60 coins. With them you can only spend 1 provision
  to move through forests.
- **Gnome**: You can learn a random Basic Magic for 80 coins.
- **Goblin**: You can buy a Verdosa Potion for 30 coins. When drinking, roll a die. If it's 3 or more you
  regain all your HP. If not you will be itchy for a whole day.
- **Orc**: You can buy an Orc Gladio (1d6+1 damage) for 70 coins.

#### Affinity Between Races

If you are of a race that has an affinity for the city or fortress, you can enter and do city actions
normally. However, some places you will be banned from entering or trading.

**Table: Affinity**

| Your Race | Human | Dwarven | Elven | Gnome | Goblin | Orc |
|---|---|---|---|---|---|---|
| Human | Ok | Ok | Ok | Ok | Not allowed | Not allowed |
| Dwarf | Ok | Ok | Not allowed | Ok | Not allowed | Not allowed |
| Elf | Ok | Not allowed | Ok | Ok | Not allowed | Not allowed |
| Gnome | Ok | Ok | Ok | Ok | Ok | Not allowed |
| Halfling | Ok | Ok | Ok | Ok | Ok | Not allowed |
| Pixie | Ok | Not allowed | Ok | Ok | Ok | Not allowed |
| Catfolk | Ok | Ok | Ok | Ok | Ok | Not allowed |
| Rinoceroid | Ok | Ok | Ok | Ok | Ok | Not allowed |
| Lightbugster | Ok | Ok | Ok | Ok | Ok | Not allowed |
| Slimeman | Ok | Ok | Ok | Ok | Ok | Ok |
| Dragonkin | Ok | Not allowed | Not allowed | Ok | Ok | Ok |
| Goblin | Ok | Not allowed | Not allowed | Ok | Ok | Ok |
| Orc/Ogre | Not allowed | Not allowed | Not allowed | Not allowed | Ok | Ok |
| Other race... | Ok | Ok | Ok | Ok | Ok | Not allowed |

### Finding Dungeons

Unlike the basic mode, dungeons around a city are limited and you have to explore new cities or discover
hidden dungeons around the world. When you arrive in a town, you can go to the tavern and ask about
nearby dungeons. If you don't already have a dungeon in any adjacent hex, roll 1d6. Count each side of
the hexagon starting at the top clockwise. In this hex there will be a dungeon (draw on the map). If the
hex has Water or another City or Ruins, go clockwise to the next hex until you find land that has no
location and isn't water.

The dungeon you find depends on the terrain in the table below. A **Fortress** may also have an extra
dungeon to explore: roll a die, on a 3 or more it has **Sewers** (page 46) under the fortress.

**Table: Dungeon Type (1d6, by terrain)**

| 1d6 | Plain | Mountain | Forest | Swamp | Desert | Tundra |
|---|---|---|---|---|---|---|
| 1 | Palace (Page 12) | Crypt (Page 14) | Tomb (Page 16) | Crypt (Page 14) | Prison (Page 22) | Prison (Page 22) |
| 2 | Crypt (Page 14) | Sanctuary (Page 18) | Temple (Page 20) | Tomb (Page 16) | Palace (Page 12) | Palace (Page 12) |
| 3 | Tomb (Page 16) | Prison (Page 22) | Palace (Page 12) | Sanctuary (Page 18) | Sanctuary (Page 18) | Crypt (Page 14) |
| 4 | Sanctuary (Page 18) | Citadel (Page 48) | Temple (Page 20) | Temple (Page 20) | Temple (Page 20) | Tomb (Page 16) |
| 5 | Temple (Page 20) | Mine (Page 62) | Laboratory (Page 54) | Prison (Page 22) | Pyramid (Page 50) | Ziggurat (Page 52) |
| 6 | Prison (Page 22) | Cave (Page 62) | Cave (Page 62) | Necropolis (Page 56) | Pyramid (Page 50) | Ziggurat (Page 52) |

You can add more cool names for the dungeon. Roll 3d6 (one per column below) and join the result with
the Dungeon Type to form its name: **[Part 1] + [Dungeon Type] + [Part 3] + [Part 4]**.

**Table: Dungeon Name — extra parts (3d6, one roll per column)**

| 3d6 | Part 2 | Part 3 | Part 4 |
|---|---|---|---|
| 3 | The Sacred ... | ... of the Heavenly ... | ... Angels |
| 4 | The Pale ... | ... of the Sacred ... | ... Statues |
| 5 | The Deceitful ... | ... of the Lucky ... | ... Serpent |
| 6 | The Bloody ... | ... of the Bloody ... | ... Road |
| 7 | The Sinister ... | ... of the Gloomy ... | ... Sadness |
| 8 | The Misty ... | ... of the Dark ... | ... Vale |
| 9 | The Secret ... | ... of the Ethernal ... | ... Silence |
| 10 | The Lost ... | ... of the Dead ... | ... King |
| 11 | The Cursed ... | ... of the Frost ... | ... Queen |
| 12 | The Abandoned ... | ... of the Flaming ... | ... Horror |
| 13 | The Evil ... | ... of the Night ... | ... Death |
| 14 | The Grimy ... | ... of the Radiant ... | ... Path |
| 15 | The Ruined ... | ... of the Raging ... | ... Sorceress |
| 16 | The Twisted ... | ... of the Unlucky ... | ... Soldier |
| 17 | The Stinky ... | ... of the Feathered ... | ... Hound |
| 18 | The Demonic ... | ... of the Demonic ... | ... Hell |

### Getting Money

If you end up with no money, torches, or provisions:

- **Hard work**: In a city, spend a few years working hard for more than daily bread. Permanently lose
  1 HP and gain 1d6+1 coins.
- **Gamble**: In a city or fortress, spend 1 coin and roll a die. If you roll 6 you get 6 coins; if less,
  you get nothing. If you don't have money, you can bet your life. If you drop less than 6, someone kills
  you or sends you to work as a slave in some lost mine; if you drop 6 you stay alive and earn 5 coins.
- **Thug Life**: Steal money from travelers. In a city roll 2d6, in a fortress roll 3d6, and compare with
  the table below.
- **Fighting in The Arena**: In a Fortress you can choose to fight in the gladiator arena. You never know
  who your opponent will be. If you win, you get 20 coins; if you lose, your character dies.

**Table: Stealing from Travelers (Xd6: 2d6 in a city, 3d6 in a fortress)**

| Xd6 | What happened... |
|---|---|
| 2-4 | You went to rob an adventurer but he saw you and killed you right away! |
| 5-7 | You got caught by the guard and ended up in jail. To try to escape you will lose 1d6 HP in the process. If you are still alive, you have fled (and will no longer be able to enter this city). |
| 8 | You managed to steal 2 coins. |
| 9 | You managed to steal 5 coins. |
| 10 | You managed to steal 7 coins. |
| 11-12 | You managed to steal 10 coins. |
| 13-14 | You managed to steal 20 coins. |
| 15 | You managed to steal 1 Crypt Treasure! |
| 16 | You managed to steal 1 Sanctuary Treasure! |
| 17-18 | You managed to steal 1 Palace Treasure! |

**Table: Arena Champion (3d6)**

| 3d6 | Arena Champion |
|---|---|
| 3 | The Reaper (30 HP; 6 dmg; Deathtouch) |
| 4 | The Rock (50 HP; 4 dmg; Stoneskin) |
| 5 | Giant Worm (30 HP; 10 dmg) |
| 6 | Green Ogre (23 HP; 11 dmg) |
| 7 | War spider (18 HP; 5 dmg; Poison) |
| 8 | Barbarian in loincloth (16 HP; 7 dmg) |
| 9 | Ogre & Goblin (30 HP; 6 dmg; Weakness) |
| 10 | Gladiator Orc (7 HP; 4 dmg) |
| 11 | Gladiator Goblin (4 HP; 2 dmg; Explosivo) |
| 12 | Furious Dwarf (9 HP; 4 dmg) |
| 13 | Berserker Elf (8 HP; 3 dmg) |
| 14 | Bronze Sentry (20 HP; 6 dmg) |
| 15 | The Masked Warrior (20 HP; 9 dmg) |
| 16-18 | Ogre in thong (22 HP; 7 dmg) |

### Ruins

Upon reaching a Ruins hex, roll 2d6 and refer to the table below according to the Ruins terrain. The
result is a kind of dungeon found there.

**Table: Dungeon Type (2d6, by ruins terrain)**

| 2d6 | Plains | Mountain | Forest | Tundra |
|---|---|---|---|---|
| 2-4 | Cave (Page 62) | Cave (Page 62) | Cave (Page 62) | Cave (Page 62) |
| 5-7 | Palace (Page 12) | Crypt (Page 14) | Tomb (Page 16) | Prison (Page 22) |
| 8-9 | Laboratory (Page 54) | Citadel (Page 48) | Laboratory (Page 54) | Ziggurat (Page 52) |
| 10-11 | Pyramid (Page 50) | Mine (Page 62) | Ziggurat (Page 52) | Necropolis (Page 56) |
| 12 | Entrails* (Page 58) | Mega Dungeon* (Page 60) | Entrails* (Page 58) | Mega Dungeon* (Page 60) |

Dungeons marked with an asterisk (*) are unique dungeons. Once you put one on your map it can't appear
again — if rolled again, roll again.

### Portals

During exploration you can find portals all over the world. When going through a portal there is no
turning back and you will never know where you'll end up. When entering a portal, roll 3d6 on the table
below. Once you've established where a portal leads, you don't need to roll again for it.

**Table: Going through the Portal (3d6)**

| 3d6 | What happened? |
|---|---|
| 3 | Your character has disappeared from existence. |
| 4 | You went to Hell (see below). |
| 5 | You went to Pesadelum (see below). |
| 6 | You went to the future, and all cities are destroyed (Ruins). |
| 7 | You appeared at the beginning of a new Dungeon but no door to exit. In the Boss's room there will be a Portal. |
| 8 | You went to Underworld (see below). |
| 9 | You appeared in the middle of the nearest town (even if it's an enemy town). |
| 10 | You appeared in the middle of the nearest human city. |
| 11 | You go to whatever hexagon you want (even from another world). |
| 12 | You went to another reality. Create a new map from scratch. |
| 13 | You are still in the same place but now whenever you reveal a Plain you find Water. |
| 14 | You appeared in a city in the clouds where the Slimemen live. They are very nice and hospitable. If you want, they open a new portal to send you back wherever you want. |
| 15 | You appeared in a golden room with no doors. In the center there are 300 coins and on the back wall another Portal. |
| 16 | You went to Pesadelum (see below). |
| 17 | You went to Candy World (see below). |
| 18 | You went to Hell (see below). |

### Other Worlds

#### Hell

Make a new map, using the tables below to generate terrain. You start on a Plain. Also use the Location
and Events tables below.

**Table: Terrain (1d6)**

| 1d6 | Terrain |
|---|---|
| 1 | Magma |
| 2 | Magma |
| 3 | Mountain |
| 4 | Plain |
| 5 | Plain |
| 6 | Plain |

**Magma**: If you enter this hex, you take 6d6 damage. There are no locations here.

**Table: Location (1d6)**

| 1d6 | Location |
|---|---|
| 1 | Demon City (like the Orc City) |
| 2 | Demon City (like the Orc City) |
| 3 | Demon City (like the Orc City) |
| 4 | Portal |
| 5 | Portal |
| 6 | City of Survivors (like Human City) |

**Table: Event (2d6)**

| 2d6 | Event |
|---|---|
| 2 | Infernal Baron (60 HP; 9 dmg) |
| 3 | Demon Lord (30 HP; 8 dmg) |
| 4 | Demon (10 HP; 3 dmg) |
| 5 | 2d6 Imps (2 HP; 1 dmg) |
| 6 | Fire rain (lose 3 HP) |
| 7+ | Nothing happens... |

If you defeat Demon Lord or Infernal Baron, you'll encounter 1d6 Magic Items (roll on the table on
page 23 — the Palace Reward Magic Item column). With the death of the Infernal Baron, a Portal is opened
in place of his body.

#### Underworld

Make a new map, using the table below to generate terrain. You start on a Swamp. Also use the Location
and Events tables below.

**Table: Terrain (1d6)**

| 1d6 | Terrain |
|---|---|
| 1 | Water |
| 2 | Water |
| 3 | Mountain |
| 4 | Swamp |
| 5 | Swamp |
| 6 | Swamp |

**Table: Location (1d6)**

| 1d6 | Location |
|---|---|
| 1 | Dense fog (cannot pass through) |
| 2 | Dense fog (cannot pass through) |
| 3 | Dense fog (cannot pass through) |
| 4 | Dense fog (cannot pass through) |
| 5 | Portal |
| 6 | Portal |

If you encounter a land with Mist, you can spend 1 provision to wait for it to dissipate.

**Table: Event (2d6)**

| 2d6 | Event |
|---|---|
| 2 | The Death (30 HP; 3 dmg; Deathtouch) |
| 3 | Ghost (4 HP; 3 dmg; Intangible) |
| 4 | Ghost (2 HP; 2 dmg; Intangible) |
| 5 | Ominous fog (lose 1 provision) |
| 6 | You have found the soul of an ancient dead adventurer. If you want to help him, roll 1d6. If it's 6 his soul will follow you and resurrect when he returns to the world of the living. If it's 5 or less his soul will go to hell. |
| 7+ | Nothing happens... |

If you defeat Death you can go back to any world you like (in any hex you like).

#### Pesadelum

Make a new map, using the table below to generate terrain. You start on a Plain. Also use the Location
and Events tables below.

**Table: Terrain (1d6)**

| 1d6 | Terrain |
|---|---|
| 1 | Sea of Blood |
| 2 | Forest of Impaled |
| 3 | Plain of Thorns |
| 4 | Plain of Thorns |
| 5 | Mountain |
| 6 | Mountain |

**Sea of Blood**: If you land here you take 3 damage and move to a random adjacent hex.
**Forest of Impaled**: Horrifying. If you enter here, roll a die. If it's 1 you are catatonic.
**Plain of Thorns**: Take 1 damage when entering this terrain.

**Table: Location (1d6)**

| 1d6 | Location |
|---|---|
| 1 | Goblin Fortress |
| 2 | Goblin City |
| 3 | Ruins |
| 4 | Abandoned House (find 1d6-1 coins) |
| 5 | Portal |
| 6 | Survivors City (like human city) |

**Table: Event (2d6)**

| 2d6 | Event |
|---|---|
| 2 | Dracolich (30 HP; D8; Necro) |
| 3 | Tentacle (20 HP; D6; Regen) |
| 4 | 1d6 Goblins (3 HP; D1; Explo.) |
| 5 | Temporal distortion (move to random 1 hex) |
| 6 | Temporal distortion (move to random 1 hex) |
| 7+ | Nothing happens... |

If you defeat the Tentacle, you will find a Dream Potion (If you drink it you can reverse your HP number,
trading the Ten value with the Unit).

#### Candy World

Make a new map, using the table below to generate terrain. You start on a Caramel Plain. Also use the
Location and Events tables below.

**Table: Terrain (1d6)**

| 1d6 | Terrain |
|---|---|
| 1 | Milk Shake Sea |
| 2 | Milk Shake Sea |
| 3 | Lollipop Forest |
| 4 | Marshmallow Mountain |
| 5 | Caramel Plain |
| 6 | Caramel Plain |

**Table: Location (1d6)**

| 1d6 | Location |
|---|---|
| 1 | Fortress of King Mandolate (enemy) |
| 2 | Chocolate City (enemy) |
| 3 | Chocolate City (enemy) |
| 4 | Nothing. Just peanuts on the floor. |
| 5 | Nothing. Just peanuts on the floor. |
| 6 | Portal |

**Table: Event (2d6)**

| 2d6 | Event |
|---|---|
| 2 | Caking (10 HP; 4 dmg; Regen) |
| 3 | Candy apple Soldier (10 HP; 2 dmg) |
| 4 | Marshminion (4 HP; 2 dmg) |
| 5 | Marshminion (4 HP; 2 dmg) |
| 6 | Icing Rain (miss 1 provision) |
| 7+ | Nothing happens... |

If you defeat a monster, roll a treasure:

**Table: Treasure (2d6)**

| 2d6 | Treasure |
|---|---|
| 2 | 100 chocolate coins (worth 1 coin) |
| 3 | Strawberry Flavor Life Potion (recovers all HP) |
| 4 | Easter Egg (Roll a treasure from a Palace) |
| 5 | Marshmellow Boots (5 HP) |
| 6 | Gum Bullet Helmet (9 HP) |
| (no roll shown for 7-12; table as printed lists only 2-6) | |

### New Races

Instead of rolling a race on the base table, you can choose one of these tables:

**Table: Uncommon Races (1d6)**

| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Lightbugster | 16 | You start with 3 uses of the Light spell. |
| 2 | Pixie | 8 | You start the game with 5 random Basic Spells. |
| 3 | Slimemen | 10 | If you engulf the body of an enemy, you regain all HP. |
| 4 | Pumpkinkin | 16 | You start with 3 uses of the Vimes spell. |
| 5 | Cat-person | 19 | You can sell equipment in the town for twice the price. |
| 6 | Half-Human | 20 | Roll a new race and use the advantage of that. |

Uncommon Races are beings who live on the same continent but have no cities or empires. They live among
humans and other common races. You start in any human city on the map.

- **Lightbugster**: The original lightbugster lived in large forests until they were exterminated by
  centaurs, their archrivals. Today the lightbugsters are mixed among humans just waiting for the end of
  their species.
- **Pixie**: Pixies live hidden in forests. Some of them end up getting pretty bored and decide to have
  suicidal adventures.
- **Slimemen**: A legend tells that they live in big cities in the clouds, but one day there was such a
  heavy rain that they rained on the land. No slimeman remembers any of this and doesn't know where they
  came from.
- **Pumpkinkin**: These beings are born every time a swallow lays an egg on top of a pumpkin patch. They
  are clumsy and live up to 5 years.
- **Cat-person**: These nomadic people usually live in small communities and camp in isolated places.

**Table: Exotic Races (1d6)**

| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Rinoceroid | 24 | You can attack with your horn (Damage 1d6). |
| 2 | Samambro | 10 | When you die, roll a die. If results 3 or more you will come back to life with 1 HP. |
| 3 | Corvino | 14 | You start the game with 5 random Advanced Spells. |
| 4 | Patovsky | 15 | You can walk in water territories and can skip travel events. |
| 5 | Pandakhan | 30 | Spend twice as much provisions. |
| 6 | Sharkin | 18 | You can walk in water territories. |

Exotic Races come from some distant continent. When playing with one of them, you start out in a water
territory surrounded by water territories. You are on a boat.

- **Rinoceroid**: They live in big cities in the distant savannas. Some do not adapt to this life and
  prefer to go out into the world in search of adventure.
- **Samambro**: Plant-like beings live peacefully in small communities in a distant jungle. They don't
  cause war and prefer to listen to music and tell jokes.
- **Corvino**: They have no cities and live in isolated huts in distant swamps. Some end up traveling in
  search of wealth and fame.
- **Patovsky**: They live in a great nation built on a great civil war. Some travel the world looking to
  find political allies.
- **Pandakhan**: Conquerors and territorialists, these people have already conquered half the continent
  where they live. Some travel the world in search of becoming a new great emperor of the place.
- **Sharkin**: They live in big underwater cities in the middle of the ocean. They have a very closed
  society and do not allow anyone to enter or leave. Only criminals are exiled and sent to the surface.

**Table: Monstrous Races (1d6)**

| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Goblin | 3 | If you roll 1 on the damage die, you explode. Dealing 5 damage to everyone in the room. |
| 2 | Orc | 21 | None. |
| 3 | Centaur | 19 | Spend half of your provisions when moving around the map. |
| 4 | Fungoid | 10 | At any time, spend 1 provision and heal 1d6 HP. |
| 5 | Ogre | 40 | Cannot use potions, scrolls or wear armor. Deals +2 damage. |
| 6 | Dragonkin | 30 | You start with 3 uses of the Fireball spell. |

Monstrous Races are seen as monsters by all civilized peoples. You start the game in an Orc or Goblin
town in a Mountain or Forest territory (respectively).

- **Goblin**: Goblins live in packs and besides enjoying playing with explosives, they have a great
  tendency to spontaneously explode. Their cities are big, made of hollow tree trunks and dirt.
- **Orc**: They live in large heavily militarized cities. They have a great sense of hierarchy and will
  impose their laws on everyone.
- **Centaur**: In the past, centaurs banded together to destroy civilizations just for fun. Until the
  arrival of humans, when they lost the competition. The few who still live have allied themselves with
  orcs and goblins, and some of them even rule goblin cities.
- **Fungoid**: All Fungoid originates in a single city: Fungopolis. A mega underground city so hidden that
  few people know where it is. After leaving there, a Fungoid looks for another civilization to live with,
  and they usually ally themselves with goblins and orcs.
- **Ogre**: Big and dumb. They cannot form a simple sentence and can be fooled by the dumbest goblin. They
  usually live with goblins and orcs in their cities, providing services of all kinds.
- **Dragonkin**: No one knows how they come about, but sometimes they come from dragon eggs abandoned by
  the female. With no way out, they end up allied with the orcs where they live. Some goblins worship them
  as gods.

### Prohibited Races

These races were ideas of users of the Facebook group and have no description other than their own name.
Use them at your own risk. Roll two dice in order and compare the results in the first two columns
(first die selects the group 1-6, second die selects the row within the group 1-6).

**Table: Races that shouldn't exist (1d6 group, 1d6 row)**

Group 1:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Steambot | 18 | No need to consume Provisions. |
| 2 | Capivoraz | 16 | Start the game with 20 coins. |
| 3 | Blankin | 20 | It has two uses of the Lightning spell. |
| 4 | Lobisoide | 20 | When you destroy doors, you attack first. |
| 5 | Tri-kri-kri | 12 | It has 4 arms and consumes only 1 provision in deserts. |
| 6 | Gnoblin | 5 | You can say it's a gnome or a goblin. |

Group 2:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Sandboy | 7 | It can pass through locked or trapped doors without activating it. |
| 2 | Dolphmen | 11 | Can move on water terrain. |
| 3 | Geckoid | 10 | When Silent Move, roll two dice and discard the smaller one. |
| 4 | Smart Zombie | 10 | You can play dead and run away from combat. |
| 5 | Half-god | 30 | Lose 3 HP whenever you roll 1 on your damage die. |
| 6 | Minotaurion | 24 | Can attack with its horn (1d6 damage). |

Group 3:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Fire-folk | 10 | It is immune to Firebreath. |
| 2 | Water-folk | 10 | Can pass through locked doors. |
| 3 | Earth-folk | 20 | None. |
| 4 | Air-folk | 10 | Ignore all traps. |
| 5 | Frogoid | 20 | You can hold torch with your tongue. |
| 6 | Doggo | 18 | Cannot wear armor. |

Group 4:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Vampirim | 18 | Restores HP when killing monsters (gains 1 HP per dead monster). |
| 2 | Doggie | 8 | You can only pick things up with your mouth. |
| 3 | Ponão | 21 | Only get along with Centaurs and Dwarves. |
| 4 | Martian | 4 | Starts with a Laser Gun (1d6+5 damage). |
| 5 | Half-Goat | 18 | Spend only 1 provision to move in Mountains. |
| 6 | Shapeshifter | 16 | You can gain the Ability of a race you have encountered in play. |

Group 5:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Keyroz | 17 | If you land 1 on the damage die, you teleport to the militia lawyer's farm. |
| 2 | Olavoides | 17 | See everything in red color. Hates the color red. |
| 3 | Mimiminion | 17 | You can only wear yellow armor. Obey any soldier or guard (and be happy). |
| 4 | Sereia reversa | 20 | Smells like fish. |
| 5 | Jenypher | 16 | It has 4 arms, is bald, and can pass for a goblin or gnome. |
| 6 | Coutim | 18 | Can ignore combat with creatures with Loot, and still keep them. |

Group 6:
| 1d6 | Race | HP | Ability |
|---|---|---|---|
| 1 | Levent | 15 | You can skip travel events. |
| 2 | Aesir | 20 | It is immune to weather effects. |
| 3 | Fira | 16 | Can use its own light instead of torch, but spends 2 HP for each use. |
| 4 | Mahok | 28 | Cannot wear armor. |
| 5 | Tailox | 16 | When you roll to Find Secret Passages, roll two dice and discard the lowest. |
| 6 | Juban | 21 | They cannot move in silence. |

### Advanced Classes

After exploring some dungeons, your character is no longer the same. With money accumulated, it's time
to become someone more important. Below is a list of Advanced Classes your character can acquire. All
require a cost of money, reflecting the work and disposition of teachers and resources for their
training. Some classes require another requirement you must follow. You can acquire as many classes as
you like, but cannot acquire the same class more than once.

**Table: Advanced Classes**

| Class | Cost | Requirement | HP | Ability |
|---|---|---|---|---|
| Avenger | 10 | Having avenged the death of a relative | +2 | None. |
| Ruthless | 20 | Have killed 10 Imps | +1 | None. |
| Goblinator | 20 | Have killed 20 goblins | +0 | Take -2 damage per Explosion. |
| Miner | 20 | Have survived two dungeons | +1 | If run out of torches, can leave the dungeon. |
| Gravedigger | 30 | Having lost another character. | +0 | Deals +2 damage to Undead. |
| Gladiator | 30 | Having fought in an Arena. | +3 | None. |
| Janitor | 30 | Killed all creatures from a Sewer | +1 | None. |
| Collector | 30 | Find all pieces of an armor | +0 | Sell a piece of armor for 5 coins. |
| Hotep | 30 | Have killed 3 mummies | +1 | None. |
| Bugcatcher | 30 | Have killed 10 insects or arachnids | +0 | +1 damage against insects and arachnids. |
| Orcslayer | 40 | Having killed an Orc King or Leader | +2 | None. |
| Dragonslayer | 50 | have slain a dragon | +3 | None. |
| Guard | 50 | Have killed at least 3 monsters. | +1 | None. |
| Helsing | 50 | have killed 2 vampires | +0 | +1 damage against Vampires and Ghouls. |
| Scholar | 70 | Have used a spell or scroll. | +0 | Earn 3 random Basic Spells. |
| Lumberjack | 70 | Having traveled through two forests. | +1 | None. |
| Ghostbuster | 80 | Have killed 10 intangible beings | +0 | Can ignore Intangible on first turn. |
| Cook | 100 | Have spent 20 provisions on the road. | +0 | Gain 1 Provision per defeated monster. |
| Blacksmith | 100 | Ter tido uma armadura destruída. | +1 | Can recover an armor by spending 1 Torch. |
| Ambidextrous | 100 | Have killed 2 dungeon bosses. | +0 | Can attack with 2 weapons (one in each hand). |
| Mage | 100 | Know 3 basic spells. | +1 | Earn 4 random Basic Spells. |
| Warrior | 100 | Have killed 1 dungeon boss. | +2 | None. |
| Merchant | 100 | Have sold an item. | +0 | Can sell items for double the value. |
| Pirate | 100 | Have sailed through 5 territories. | +1 | Ignores Poison. |
| Survivor | 100 | Having walked through two deserts. | +4 | None. |
| Thief | 120 | Have opened at least 4 locks. | +0 | Does not waste torches when Opening Locks. |
| Multidextrous | 200 | Be Ambidextrous. | +0 | Can attack with every weapon you are using. |
| Noble | 200 | Talk to the King of a Fortress. | +0 | Can build a castle in an empty region. |
| Cleric | 200 | Having faced an undead. | +1 | Get 2 uses of the Heal spell. |
| Druid | 200 | Have passed through 6 forests. | +0 | Earn 4 random Nature Spells. |
| Necromancer | 200 | Have used Cold Ray spell. | +0 | Earn 4 random Death Spells. |
| Bard | 200 | Have passed through 3 cities. | +1 | Gain 3 uses of Paralyze advanced spell. |
| Paladin | 200 | Be a Knight or a Cleric. | +3 | Gain 3 uses of the Heal spell. |
| Anti-Paladin | 200 | Be a Paladin. | +3 | Gains 4 Death Spells but loses all Healing spells. |
| Elementalist | 300 | Have a Fire and an Ice spells. | +2 | Gain 4 random Elemental Spells. |
| Champion | 300 | Have cleaned 4 dungeons. | +6 | You don't need to spend money to recover. |
| Knight | 400 | Be Noble. | +2 | Gain a Horse. |
| Necromaster | 400 | Be Necromancer and killed a Lich. | +4 | Gain 4 random Death Spells. |
| Assassin | 400 | Be a Thief and having killed a boss. | +3 | Deals 3 times damage on your first attack. |
| Alchemist | 400 | Know 4 any spells. | +2 | Spending 50 coins makes 1 Health Potion. |
| Arcane | 500 | Know 6 different Spells. | +3 | Gain 4 random Advanced Spells. |
| Lich | 500 | Be Necromaster and having died. | +6 | Gain 4 random Death Spells. |
| Lord | 600 | Having built a castle. | +0 | You can build a City. |
| King | 1000 | Having built a city. | +0 | You can build a fortress. |
| Emperor | 6000 | Have 1 fortress and 3 vassals. | +0 | Rule the world. |

*(Note: "Ter tido uma armadura destruída" for Blacksmith is left in the original Portuguese in the
source PDF — it translates to "Have had an armor destroyed.")*

### New Spells

**Table: Nature Spells (1d6)**

| 1d6 | Spell | Effect |
|---|---|---|
| 1 | Natural Cure | Recovers 12 HP. |
| 2 | Vimes | Leaves a monster without attacking for 1d6 turns. |
| 3 | Camouflage | Can ignore an Event generated in a forest or swamp territory. |
| 4 | Create Food | Creates 2d6 Provisions. |
| 5 | Summon Wolf | Summons a Wolf (4 HP; Damage 2) to help you until the end of the fight. |
| 6 | Insect Rain | Attack that deals 7 damage to all opponents. |

**Table: Death Spells (1d6)**

| 1d6 | Spell | Effect |
|---|---|---|
| 1 | Ethereal Body | Until the end of the fight, all damage you take will be reduced by 1 point. |
| 2 | Absorb Soul | After a fight, recover 5 HP for each monster killed. |
| 3 | Banish the Dead | Destroy any Undead that are in the same area as you. |
| 4 | Fire of the Dead | After a fight, you get 2 torches for every monster killed. |
| 5 | Summon Skeleton | Summons a Skeleton (4 HP; Damage 1; Undead) that will stay until you exit the dungeon. |
| 6 | Awakening | Summons 1d6 Skeletons (4 HP; Damage 1; Undead) to aid you until the end of combat. |

**Table: Elemental Spells (1d6)**

| 1d6 | Spell | Effect |
|---|---|---|
| 1 | Summon Elemental | Summons an Elemental (3 HP; Damage 2) to aid you until the end of the fight. |
| 2 | Stone Armor | Creates a piece of armor with 5 HP. It destroys itself after you leave the dungeon. |
| 3 | Cold Ray | Deals 4 damage to one monster and it cannot attack next turn. |
| 4 | Lightning | Deals 6 damage to one monster. |
| 5 | Fireball | Deals 5 damage to all monsters in the same room. |
| 6 | Collapse | A dungeon room is completely destroyed with everything inside. |

**Table: Advanced Spells (2d6)**

| 2d6 | Spell | Effect |
|---|---|---|
| 2 | Insect Rain | Attack that deals 7 damage to all opponents. |
| 3 | Open Portal | You can open a temporary Portal. You don't know where it's going. |
| 4 | Create Food | Creates 2d6 Provisions. |
| 5 | Paralyze | Leave all monsters in a room without attacking for 2 turns. |
| 6 | Fly | Can move through any land without spending any Provision and activate Event. |
| 7 | Reload Mana | Recovers 1 use of another spell. |
| 8 | Magic Shield | Once created, it can absorb 4 damage points. Can cast more than one. |
| 9 | Stone Armor | Creates a piece of armor with 5 HP. It destroys itself after you leave the dungeon. |
| 10 | Magic Blast | Attack that deals 12 damage. |
| 11 | Summon Elemental | Summons an Elemental (3 HP; Damage 2) to aid you until the end of the fight. |
| 12 | Ethereal Body | Until the end of the fight, all damage you take will be reduced by 1 point. |

### Hireling

A Hireling is anyone willing to help you in exchange for money. You can only hire Hirelings in one city
or fortress. You pay your cost to face just one dungeon (you can go back if necessary). You also pay for
Provisions for each of them during the trip.

Hirelings can carry up to 20 provisions and 10 torches, but you must pay for them. You can give a
hireling equipment and weapons, but he won't give them back. Most can fight and hold the torch for you.
Some may provide different services during your journey.

The following tables show hireling options depending on the city or fortress you are in.

**Table: Hireling — Human City or Fortress**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Torchbearer | 10 | 10 | None and doesn't know how to fight. | None |
| Mercenary | 30 | 14 | None. | Club (1d6-2 damage) |

**Table: Hireling — Human Fortress**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Jester | 30 | 17 | Can clown. | None |
| Burglar | 40 | 14 | Open locks without wasting torches. | Dagger (1d6-1 damage) |
| Bodyguard | 60 | 16 | None. | Shortsword (1d6 damage) |
| Minstrel | 60 | 16 | Can play music in combat (+2 damage). | Mandolin (Two-handed) |
| Rent Wizard | 80 | 14 | Can cast 4 random Basic Spells. | Staff (1d6-1 damage) |
| War Veteran | 100 | 16 | None. | Longsword (1d6+1 damage) |

**Table: Hireling — Elven City**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Elf Ranger | 30 | 11 | Ignores Travel Events. | Saber (1d6 damage) |
| Elf Soldier | 60 | 13 | Can cast 3 random Basic Spells. | Staff (1d6-2 damage) |

**Table: Hireling — Dwarf City or Fortress**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Dwarf Miner | 40 | 15 | To Find Secret Passages, roll two dice. | Pickaxe (1d6-1 damage) |
| Dwarf Soldier | 50 | 16 | Deals +1 damage against Orcs and Goblins. | Axe (1d6+1 damage) |

**Table: Hireling — Gnome City**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Gnome Helper | 30 | 7 | Can cast 4 random Basic Spells. | None |

**Table: Hireling — Orc or Goblin City or Fortress**

| Hireling | Cost | HP | Extra Service | Equipment |
|---|---|---|---|---|
| Goblin Helper | 10 | 1 | It can explode at any time, dealing 5 damage. | None |
| Orc Soldier | 50 | 17 | None. | Gladio (1d6 damage) |
| Cargo Ogre | 80 | 40 | Can carry 40 items (return it to you at the end) | can't use anything |

### Training Animals

You can train an animal to follow you on your adventures. To train one of the animals below, you must
first go to the appropriate terrain. This land must be empty (no location) and have at least 2 lands of
the same type adjacent to it. Once there, spend 4 provisions and roll a die. If the number is equal to or
greater than the animal's "Dif," you managed to train it.

You cannot have more than 3 animals. Only one of these can be a mount.

**Table: Domesticated Animals**

| Animal | Dif | Terrain | HP | Dmg | Ability |
|---|---|---|---|---|---|
| Cat | 3 | Plain or Forest | 2 | 1 | None. |
| Dog | 2 | Plains | 3 | 2 | In the dungeon, it doesn't allow you to Move in Silence. |
| Snake | 4 | Any | 2 | 1 | Attack deals Poison. |
| Raven | 4 | Swamp or Tundra | 2 | 1 | If you die, roll a die. If it's 4 or more, you come back. |
| Eagle | 5 | Mountain | 3 | 2 | You can open an extra hex with each move. |
| Owl | 4 | Forest | 2 | 2 | Can only spend 1 provision to traverse Forests. |
| Monkey | 4 | Forest | 2 | 1 | It can carry an extra item or use a weapon. |
| Goat | 4 | Mountain | 4 | 3 | You can only spend 2 provisions to cross Mountains. |
| Wolf | 5 | Forest or Tundra | 5 | 3 | None. |
| Polar Bear | 5 | Glacier | 6 | 2 | None. |
| Tiger | 6 | Forest | 8 | 4 | Cannot enter dungeons. |

Mounts cannot enter dungeons, and training them requires 8 provisions. Alternatively, you can buy mounts
in a city that is on the appropriate terrain (and also has at least two of the same land adjacent to it).

**Table: Mounts**

| Mount | Dif | Terrain | HP | Dmg | Ability | Cost |
|---|---|---|---|---|---|---|
| Horse | 3 | Plains | 10 | 1 | For 1 provision you can move across 2 Plains. | 50 |
| Camel | 2 | Desert | 8 | 1 | Spend only 1 provision to move in Deserts. | 30 |
| Llama | 5 | Mountain | 6 | 1 | Spend only 2 provisions to move in Mountains. | 70 |
| Giant wolf | 5 | Forest | 6 | 2 | Spend only 1 provision to move in Forests. | 80 |
| Mammoth | 6 | Tundra | 20 | 5 | You spend 1 extra provision per hex. | 500 |
| Raptor | 5 | Swamp | 6 | 3 | Spend only 1 provision to move in Swamps. | 100 |
| Dolphin | 5 | Water | 4 | 1 | Moves only in water. | 50 |
| Griffin | 6 | Mountain | 12 | 4 | Spend only 1 provision for any land. | 2000 |

### Buildings

There comes a time in a hero's life when he must retire his sword and enjoy the luxuries of a grand
castle. Rules for spending accumulated money on your adventures:

To build any of the buildings below, you must be in a territory that is empty. Buildings on Plains have
no change in cost, but buildings made on other lands cost twice as much. Dwarves do not suffer this
increase if it is in mountains and Elves do not suffer this increase if it is in forests.

In a building you can store any number of items found in dungeons. However, whenever you leave a dungeon
roll a die. If it drops a number greater than the building's Defense value, a random item has been
stolen.

It is possible to build on top of another building, spending only the difference in cost.

**Table: Buildings**

| Building | Cost | Requirement | Defense | Collect Taxes |
|---|---|---|---|---|
| House | 200 | None | 2 | None. |
| Tower | 400 | None | 4 | None. |
| Palace | 600 | Be a Noble | 4 | You get 150 coins when you kill a Dungeon Boss. |
| Castle | 600 | Be a Noble | 5 | You get 100 coins when you kill a Dungeon Boss. |
| City | 1000 | Be a Lord | 6 | You get 200 coins when you kill a Dungeon Boss. |
| Fortress | 3000 | Be a King | 12 | You get 300 coins when you kill a Dungeon Boss. |

### Politics

The world is ruled by Lords and Kings. Each City has a Lord and each Fortress has a King. Cities up to 3
hexes away from a Fortress of the same race are considered Vassals — under the control of the King.
Nobles can own Palaces or Castles but have very little influence politically.

In-game, you can purchase these titles with Advanced Classes and building Buildings. When that happens
you can enter the politics of the realms: go to the city or fortress and roll on the Affinity table
below. If you get an equal or higher number, you got the affinity of this one; if not, he became your
enemy. If you are a Lord and that city is within 3 hexes of your building, passing this test you have
made him your Vassal.

**Table: Political Affinity**

| Your Race | Human | Dwarf | Elf | Gnome | Goblin | Orc |
|---|---|---|---|---|---|---|
| Human | 4 | 5 | 5 | 5 | 5 | 7 |
| Dwarf | 5 | 4 | 6 | 5 | 6 | 8 |
| Elf | 5 | 6 | 4 | 5 | 6 | 7 |
| Gnome | 5 | 5 | 5 | 4 | 5 | 7 |
| Halfling | 4 | 4 | 4 | 3 | 4 | 5 |
| Pixie | 5 | 6 | 5 | 5 | 5 | 7 |
| Slimeman | 5 | 5 | 5 | 5 | 5 | 5 |
| Dragonkin | 5 | 6 | 6 | 4 | 4 | 4 |
| Goblin | 5 | 6 | 5 | 4 | 4 | 4 |
| Orc/Ogre | 7 | 8 | 7 | 6 | 4 | 4 |
| Others... | 5 | 6 | 5 | 5 | 5 | 6 |

### Warfare

Every City or Fortress can make a troop available for war. If you own a castle, you already have troops
at your disposal. You can team up with other lords or kings and declare war on others.

Move your character to the City or Fortress you want to attack, taking with you all the troops you
recruit. Each of these troops will no longer return home and will be fighting. Then roll one die per
troop sent. Add up the dice results and compare to the target's defense. Against a City the defense is
6, and against a Fortress the defense is 12.

If the attack's result is equal to or greater than the Building's Defense, the attack was successful and
the city was taken. If the result is less than the defense, the attack was a failure.

If you want, you can put your character to fight with your troops. If you do, you can roll one more die.
However, if this die falls to number 1 and the battle is lost, your character will die in battle.

#### Mustering Troops

To attack an enemy building, you must first have troops. You can only recruit troops in a Castle, City or
Fortress, and you will need to spend 200 coins for each. No building can have more than 1 troop recruited
at a time. You can recruit troops from vassal or conquered Cities and Fortresses.

#### Declared Enemies

If you fail a Political Affinity check with any Lord or King, he is considered your enemy. Whenever you
attack a building, roll a die for each enemy you have (that is not the target of the attack). If it's 4
or more, nothing happens. But if it's between 1 and 3, it means this enemy has sent this number of troops
to attack your building that is closest to him (in case of doubt he will attack the building with less
defense). If he wins, he will have completely destroyed the place (turning into Ruins).

#### Storming the Castle

When taking a building, you can choose between *Attach to your Realm* or *Loot the City*.

To attach a building to your realm, convince the people of the place by rolling again on the Political
Affinity table, but with a +2 bonus to the roll. If you succeed, you place a representative of your race
to rule there for you, and gain all the advantages of having a vassal. If you can't, you'll only have the
option of looting the place.

If you choose to Loot, you destroy the place completely (mark it on the map as Ruins) and gain 200 coins
if it's a castle, 600 coins if it's a city, or 1000 coins if it's a fortress.

### Group Play

Rules for when your character is not alone — using Hirelings, Animals, Summoned Creatures, or playing
with a friend.

#### Combat

Monster abilities are not activated by the result of a player's damage die. Instead, make an exclusive
roll for the monsters: roll 1d6 in the monster's turn to see if it activates any abilities it might have.

After that, monster damage is calculated and the player (or players) split the total damage between the
characters. You can distribute this however you like as long as everyone involved takes at least 1 point
of damage.

*Example*: You have two hirelings by your side and two orcs attack. Each orc deals 3 damage, making their
attack 6 damage total. You decide one hireling is important and don't want them to take too much damage,
so they only take 1 damage. The other has 3 HP left, so you choose to have them take 2 damage. There are
still 3 damage points that go to your character.

#### Multiplayer

These rules apply if you are playing with another friend, each with a character exploring the same
dungeon.

- Whenever you roll on the Monsters table, roll a number of times equal to the number of players (e.g.,
  3 players → roll 3 times on the Monsters table for each room opened).
- Each player can carry up to 10 torches, but only one needs to use one in a dungeon (if they are
  together).
- The number of Treasures remains the same, so players must divide among themselves.
- The Dungeon Boss always has HP multiplied by the number of players. E.g., 3 players encounter a Dragon
  → it has 90 HP (3 x 30 = 90).

---

## Deadly Dungeons

Additional, harder dungeon types.

### Sewers (page 46)

Every fortress has a sewer complex. Going down a manhole by a dirty metal ladder, you arrive at a tunnel
at an intersection with 4 corridors with water flows (north, south, east, west). Every tunnel here has
stinky, dark shallow water running through.

**Table: Segments (1d6)**

| 1d6 | Following a Tunnel | Open from a Tunnel | Open from a Room |
|---|---|---|---|
| 1 | Tunnel that ends in a Floodgate. | A small room. | A small room. |
| 2 | Tunnel follows. Has a Floodgate. | A small room. | A small room. |
| 3 | Tunnel follows. Has a Floodgate. | An average room. | An average room. |
| 4 | Tunnel follows. | A room with a Floodgate. | An average room. |
| 5 | Tunnel follows making a curve. | A room with a Floodgate. | A tunnel that goes on. |
| 6 | Tunnel follows. Has a ladder. | A room with a Floodgate. | A tunnel that goes on. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | There's nothing here. |
| 4 | There's nothing here. |
| 5 | Found a hidden Treasure! |
| 6 | There is a hidden door here. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | One of your arms is cut off by a blade. |
| 2 | An explosion! (4 damage). |
| 3 | Gust of acid (3 damage). |
| 4 | A dart hits you (1 damage). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | It's all flooded. Spend 1 torch to leave the room. |
| 3 | Destroyed closet with a Chest inside. |
| 4 | Destroyed furniture. It may have Secret Passage. |
| 5 | 8 stacked crates. If you investigate roll 1 dice for each. If '1', it activates a Trap. If '5' or more, you have found 1 Treasure. |
| 6 | Trash pile with a Treasure inside. |
| 7 | Dirt everywhere. It may have Secret Passage. |
| 8 | A dirty bed and a sign of a recent fire. It may have Secret Passage. |
| 9 | Trash pile with a Treasure inside. |
| 10 | A metal ladder leads to the surface. |
| 11 | A trapdoor that leads to a Laboratory. |
| 12 | A lost Chest. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Rat swarm (20 HP; 2 dmg; Regeneration) |
| 3 | Cockroaches swarm (26 HP; 1 dmg; Regeneration) |
| 4 | 1d6 Goblins (3 HP; 1 dmg; Explosive) |
| 5 | Sewer Worm (10 HP; 3 dmg; Poison) |
| 6 | 1d6 Giant Rats (2 HP; 1 dmg) |
| 7-8 | There are no monsters in this room. |
| 9 | Trash Golem (15 HP; 4 dmg; Weakness) |
| 10 | 4 Bandids [sic] (5 HP; 2 dmg; Loot) |
| 11 | Walking Slime (10 HP; 1 Damage; Loot; Regeneration) |
| 12 | Giant Crocodile (30 HP; 5 dmg) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | 1d6 Torches | Perfume (It won't stink anymore) | Tetanus [Armor] (Cursed; -2 HP) |
| 2 | Health Potion (Recovers all HP) | Potty (It's like a Helm; 3HP) | Ring of Bad Luck (Cursed; Reroll the '6' on attacks) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Bell (Makes monsters open the door) | Hamelin flute (Rats, worms and insects flee) |
| 4 | Lost jewel (worth 2d6 Coins in the town) | Goblin Whistle (Goblins flee on hearing) | [Armor] of the Rat Swarm (+1 HP, but it stinks) |
| 5 | [Roll in the "Wonders" column] | Master key (Open any door) | [Weapon] of the Fly (+1 against Swarms) |
| 6 | [Roll in the "Magic Item" column] | Rusty Glaive (Two-handed; 1d6+3 Damage) | Tetanus [Weapon] (+3 against humanoids) |

**Table: Weapons and Armor (1d6)**

| 1d6 | Weapon | Armor |
|---|---|---|
| 1 | Broken Pipe (1d6-1 Damage) | Ring (0 HP) |
| 2 | Sword (1d6 Damage) | Bracelets (2 HP) |
| 3 | Wrench (1d6 Damage) | Boots (3 HP) |
| 4 | Long Fork (1d6 Damage) | Shoulderpads (3 HP) |
| 5 | Spear (1d6+1 Damage; Two-handed) | Helm (4 HP) |
| 6 | Maul (1d6+2 Damage; Two-handed) | Breastplate (10 HP) |

**Special Rules**:
- This dungeon does not have a Final Room or Dungeon Boss.
- **Floodgate**: Works like normal doors but cannot be destroyed, has no traps, and will always be
  locked.
- **Tunnels**: Tunnels work like corridors but you can't see the rest of it. Each tunnel segment
  continues the previous one. In a tunnel you must roll to add Monster but not Content.
- If you try to move silently in a tunnel, monsters detect you if you land 1 or 2 on the die.

### Citadel (page 48)

The entrance to this dungeon is an immense hall carved in stone inside a mountain. Two statues of dwarfs
brandishing their axes stand outside the heavy stone door. Upon entering, you find a huge, long room. In
the center there is a large fountain now dry, with 3 doors on each side (totaling 6 doors). All these
doors lead to a short staircase with a door at the bottom.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Small room |
| 2 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 3 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 4 | Corridor with two other doors. | Wide room with two other doors. | Big room. |
| 5 | Corridor with three other doors. | Wide room with two other doors. | Large hall with pillars. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)** — identical shape to Palace's Secret Passage table.

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | You are beheaded by a blade. |
| 2 | A giant hammer comes out of the ceiling (5 dmg). |
| 3 | You fall into a hole with stakes (3 damage). |
| 4 | A dart hits you (1 damage). |
| 5 | A dart hits you (1 damage). |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Underground Monster Hunting Trophies |
| 3 | Destroyed kitchen and 1d6 coins. It may have Secret Passage. |
| 4 | Bed with a Chest beside it. It may have Secret Passage. |
| 5 | Wardrobe with 2 Treasures. |
| 6 | Desk with a Chest below. |
| 7 | Dusted war banners. It may have Secret Passage. |
| 8 | Training Room with a Treasure. |
| 9 | Trash deposit. It may have Secret Passage. |
| 10 | Arsenal. 2d6 Treasures. |
| 11 | Large table with papers and maps. It may have Secret Passage. |
| 12 | Torture room with bones of orcs. It may have Secret Passage. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Orc Leader (12 HP; 5 damage; Loot; Horde) |
| 3 | 3 Orcs (6 HP; 3 damage; Loot) |
| 4 | 2 Orcs (6 HP; 3 damage; Loot) |
| 5 | 1 Orc (6 HP; 3 damage; Loot) |
| 6 | 1d6 Goblins (3 HP; 1 damage; Explosive) |
| 7 | There are no monsters in this room. |
| 8 | There are no monsters in this room. |
| 9 | 2 Dwarf Skeletons (4 HP; 3 damage; Undead) |
| 10 | Dwarf Ghost (6 HP; 4 damage; Intangible) |
| 11 | Golem Bones and Stone (15 HP; 6 damage; Undead) |
| 12 | Walking Slime (10 HP; 1 Damage; Loot; Regeneration) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Dwarf Statuette (6 coins) | Dwarven Bracelets (3 HP) | Ring of the Dead Man (Cursed; Cannot wear Armor) |
| 2 | Health Potion (Recovers 5 HP) [as printed: "Dwarf Beer Barrel (Recovers 5 HP)" is Wonders col] | Dwarven Shoulderpads (4 HP) | Dwarven Hammer (1d6 dmg; +2 against orcs) |
| 3 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Torch Helmet (3 HP; Fits torches) | Dwarven Battle Axe (1d6+1 dmg; +2 against orcs) |
| 4 | Jóia muito valiosa (150 Moedas) [sic, untranslated] | Orc Machete (1d6+1 Damage) | Dwarf Guard Cloak (+1 damage against orcs) |
| 5 | [Roll in the "Wonders" column] | Horn of War (Increase your damage +1) | Dwarf War Pick (1d6+2 Damage) |
| 6 | [Roll in the "Magic Item" column] | Beheaded Head of the Orc Prince (Orcs deal -1 damage) | Dwarven breastplate (10 HP; ignore Poison) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Grim Reaper (50 HP; 3 dmg; Deathtouch) was waiting for you. |
| 2 | From inside a huge hole opened in the ground a Bolrag (40 HP; 6 dmg; Firebreath) demon appears. |
| 3 | The Minotaur (30 HP; 7; Horde) is leaning on a huge ax and sitting on a throne of dwarf bones. |
| 4 | The room is very cold. In the background, sitting on a stone throne, is the Ghost of the Dwarf King (20 HP; 5 dmg; Intangible). |
| 5 | The Orc Shaman Leader (20 HP; 2 dmg; Sorcery, Horda) is surrounded by 3 Orcs (6 HP; 3 dmg). |
| 6 | The former dwarf king was corrupted by death and now he is the Cursed King (30 HP; 7 dmg; Necromancy). |

**Special Rules**: Once you defeat the Dungeon Boss, in addition to the 2d6 Treasures, you've found one
of the Dwarf Hallows (roll below).

**Table: Dwarf Hallows (1d6)**

| 1d6 | Dwarf Hallows |
|---|---|
| 1 | Standard of the Dwarf Empire (If attachment to a breastplate, +1 damage) |
| 2 | Annihilation Pick (1d6+2 Damage; If you kill a creature, it deals +2 to the next creature of the same type) |
| 3 | Heavy Axe of the Deeps (1d6+4 Damage; Two-handed; +3 against demons) |
| 4 | Dwarf God's Sledgehammer (1d6+5 damage; Two-handed) |
| 5 | Dwarf King's Helm (11 HP) |
| 6 | Dwarf King's Ax (1d6+3 Damage; +1 against Orcs) |

### Pyramid (page 50)

A huge stone structure in the shape of a pyramid. Some parts are covered with sand, but it is possible to
see a small entrance in the base. A large carved rock covers the entrance. You can move the rock a bit to
get through. Inside, a long staircase descends into darkness. It is only possible to see a metal door at
the bottom of it.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Small room. |
| 2 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 3 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 4 | Corridor with two other doors. | Wide room with two other doors. | Big room. |
| 5 | Corridor with three other doors. | Wide room with two other doors. | Large hall with pillars. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | You have activated a Trap! |
| 3 | Found a hidden Chest! |
| 4 | Found a hidden Chest! |
| 5 | Found a hidden Chest! |
| 6 | Passage to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A huge block of stone falls over you. You died. |
| 2 | Raise 1d6 Mummified Soldiers (5 HP; 2 dmg; Undead) |
| 3 | Raise 1d6 Mummified Soldiers (5 HP; 2 dmg; Undead) |
| 4 | Raise 1 Mummy (4 HP; 1 dmg; Undead) |
| 5 | Gas cloud makes you pass out (spend 1 torch). |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Sarcophagus with 2d6 Treasures. |
| 3 | Statues of animal gods. |
| 4 | A well in the center of the room. It may have Secret Passage. |
| 5 | Wall covered with drawings of animal gods. It may have Secret Passage. |
| 6 | Broken statue of some animal god. |
| 7 | Sarcophagus with Chest inside. |
| 8 | Vases with drawings of animal gods. It may have Secret Passage. |
| 9 | Wall covered with drawings of animal gods. It may have Secret Passage. |
| 10 | Dozens of melted candles everywhere. It may have Secret Passage. |
| 11 | Statue of a god with a crocodile head. It may have Secret Passage. |
| 12 | Sarcophagus with 2d6 Treasures. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Mummified Priestess (7 HP; 2 dmg; Sorcery) |
| 3 | 3 Mummified Soldiers (5 HP; 2 dmg; Undead) |
| 4 | 2 Mummified Soldiers (5 HP; 2 dmg; Undead) |
| 5 | 2 Living Armor (8 HP; 3 dmg) |
| 6 | 1d6 Giant Scarabs (3 HP; 2 dmg) |
| 7-8 | There are no monsters in this room. |
| 9 | 1d6 Scorpions (2 HP; 1 dmg; Poison) |
| 10 | 3 Living Armor (8 HP; 3 dmg) |
| 11 | Jackal God Living Statue (10 HP; 3 dmg; Stoneskin) |
| 12 | Giant Spider (10 HP; 4 dmg; Paralyze) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Golden statuette (worth 3d6 Coins in the town) | Mummified Cat (Can reroll Traps once) | Jackal God's [Armor] (Cursed; Cannot recover HP) |
| 2 | Health Potion (Recovers all HP) | Old King's Necklace (Same as 3 provisions) | Owl God's [Armor] (Gain an Advanced Spell) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Scarab amulet (Ignores traps in chests) | Desert King's [Armor] (+2 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Sacred Sun Hat (Gain 1 torch every killed 1 scorpion) | Beltramic Belt (Drives away scorpions) |
| 5 | [Roll in the "Wonders" column] | [Roll in the "Armor" table] | Desert King's [Weapon] (Deals +4 against Stoneskin) |
| 6 | [Roll in the "Magic Item" column] | [Roll in the "Weapon" table] | Seventy Nights [Weapon] (Paralyzes the target for 2 turns on the '6') |

**Table: Dungeon Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Greenish cloud covers the room. Lying on an altar is the Emperor Scorpio (30 HP; 3 dmg; Poison). |
| 2 | From inside a sarcophagus comes the Desert King (20 HP; 7 dmg; Undead). |
| 3 | There is the Eternal Queen (12 HP; 1 dmg; Sorcery) and her 10 Mummified Soldiers (5 HP; 2 dmg; Undead). |
| 4 | A monstrous image appears in the middle of the room. This is the Evil Mirage (12 HP; 5 dmg; Intangible). |
| 5 | There is the scary Giant Winged Scarab (60 HP; 3 dmg; Firebreath). |
| 6 | Standing in the middle of the room, holding his two kopesh, is the Jackal God (50 HP; 7 dmg; Necromancy). |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Scepter (1d6-1 Damage) |
| 2 | Kukri (1d6 Damage) |
| 3 | Katar (1d6 Damage) |
| 4 | Kopesh (1d6+1 Damage) |
| 5 | Scythe (1d6+1 Damage) |
| 6 | Staff (1d6+1 Damage; Two-handed) |

**Table: Armor (1d6)**

| 1d6 | Armor |
|---|---|
| 1 | Death mask (3 HP) |
| 2 | Bracelets (2 HP) |
| 3 | Boots (3 HP) |
| 4 | Shoulderpads (3 HP) |
| 5 | Helm (4 HP) |
| 6 | Breastplate (10 HP) |

### Ziggurat (page 52)

This dungeon is hidden beneath an immense pyramidal structure. A staircase leads to the top of the
pyramid. Upstairs there is a dark well that leads into darkness. There is a rope on the side. You descend
for more than twenty meters until you reach a large square room with four doors (one on each wall).

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Large hall with pillars. |
| 2 | Corridor with another door. | Medium size room with another door. | Large hall with pillars. |
| 3 | Corridor with two other doors. | Medium size room with another door. | Corridor with a door at the end. |
| 4 | Corridor with two other doors. | Medium size room with another door. | Corridor with a door at the end. |
| 5 | Corridor with three other doors. | Wide room with two other doors. | Staircase with a door in the end. |
| 6 | Corridor with three other doors. | Wide room with two other doors. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | There's nothing here. |
| 4 | Found a hidden Chest! |
| 5 | Found a hidden Chest! |
| 6 | Passage to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | You are beheaded by a blade. |
| 2 | Acid squirts from the ceiling, destroying a piece of armor you're wearing. |
| 3 | You fall into a hole with stakes (3 damage). |
| 4 | A passage opens and a Monster emerges (roll in the table below). |
| 5 | A passage opens and a Monster emerges (roll in the table below). |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Corpses of different races hung on the walls. |
| 3 | Bone of a giant snake. It may have Secret Passage. |
| 4 | Bed with a Chest beside it. |
| 5 | Cabinets with a lot of garments made of colored feathers. |
| 6 | Altar of sacrifice. It may have Secret Passage. |
| 7 | Empty room. |
| 8 | Ceiling covered with star designs. |
| 9 | Two sarcophagi. There can be Secret Passage in every sarcophagus. |
| 10 | Room of ornaments. Has 1d6 Treasures. |
| 11 | Large table with a rotten banquet. It may have Secret Passage. |
| 12 | Torture room with goblin bones. It may have Secret Passage. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Boar Tribe Leader (15 HP; 5 dmg; Loot) |
| 3 | 3 Boar Soldiers (6 HP; 3 dmg; Loot) |
| 4 | 2 Boar Soldiers (6 HP; 3 dmg; Loot) |
| 5 | Goblin Assassin (3 HP; 3 dmg; Explosive) |
| 6 | 1d6 Goblins (3 HP; 1 dmg; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | Pantera (5 HP; 4 dmg) |
| 10 | Giant Bat (10 HP; 4 dmg; Poison) |
| 11 | Sun God Living Statue (15 HP; 6 dmg; Stoneskin) |
| 12 | Giant Feathered Serpent (12 HP; 3 dmg) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Strange Fruit (If eating, recover 1 use of a spell) | Addictive Sweet Drink (Recovers 1 HP) | Crocodile Ring (Cursed; You get scales) |
| 2 | Health Potion (Recovers all HP) | Feathered Breastplate (8 HP) | Feathered Ring (Cursed; Hairs become feathers) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Feathered Boots (3 HP; Spend 1 provision on swamps) | Owl Mask (1 HP; Ignore Intangible) |
| 4 | Gold Ornament and Jewelry (worth 100 coins in the town) | Crocodile Helmet (5 HP) | Sun God's Sacrifice Dagger (1d6 dmg; +2 inside Sanctuaries) |
| 5 | [Roll in the "Wonders" column] | Star Stone (Spend 1 Provision to Reroll an Event) | Crocodile Sword (1d6+2 Damage) |
| 6 | [Roll in the "Magic Item" column] | Purification Potion (Removes a Cursed) | Helmet of the Sun God |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Behind a stone altar is Medusa (20 HP; 7 damage; Paralyze) waiting for you. |
| 2 | The floor is covered in greenish mucus. Inside the mucus comes the Sacred Skull (20 HP; 6 damage; Regen). |
| 3 | Inside the room is Hagork, God of Orcs (30 HP; 7 damage; Horde). |
| 4 | A smell of hate comes from this room. The Mysterious Peacock (17 HP; 5 dmg; Sorcery) awaits you with his tricks. |
| 5 | Holding the skull of a tiger, the Feathered Priestess (50 HP; 2 damage; Sorcery) tries to do a ritual. |
| 6 | Strong light comes from the room. Inside is the Sun God of the Feathered Spear (80 HP; 8 damage; Weakness). |

**Special Rules**: When you are in the hexagon of this dungeon (but outside the dungeon), you can spend
1 provision and roll a die in the table below.

**Table: Effect of the Forgotten Gods (1d6)**

| 1d6 | Effect of the Forgotten Gods |
|---|---|
| 1 | A big storm hits and lightning strikes you for 1d6 points of damage. |
| 2 | Nothing happens... |
| 3 | An owl follows you (use the rule on page 41). It doesn't count towards the limit of animals you can have. |
| 4 | A divine light illuminates you and you gain +1 damage on all attacks on the next dungeon exploration you make. |
| 5 | A divine light illuminates you and you gain +1 damage on all attacks on the next dungeon exploration you make. |
| 6 | A light descends from the sky and you permanently gain +4 HP. |

### Laboratory (page 54)

The entrance to this dungeon is an abandoned tower in ruins. Entering you find a large trapdoor already
open with a stairway covered in slime and plants. Downstairs you can see a rusty metal door.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Large hall with pillars. |
| 2 | Corridor with another door. | Medium size room with another door. | Large hall with pillars. |
| 3 | Corridor with two other doors. | Medium size room with another door. | Corridor with another door. |
| 4 | Corridor with two other doors. | Wide room with two other doors. | Corridor with another door. |
| 5 | Corridor with three other doors. | Wide room with two other doors. | Staircase with a door in the end. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | There's nothing here. |
| 4 | Found a hidden Chest! |
| 5 | Found a hidden Chest! |
| 6 | Passage to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade cuts off one of your hands. |
| 2 | Acid squirts from the ceiling destroying a piece of armor you're wearing. |
| 3 | You fall into a hole with stakes (3 damage). |
| 4 | Emerges a Killer Blob (9 HP; 3 dmg; Regen). |
| 5 | You hear a click, but nothing happens. |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Cabinets with bodies of dead creatures stuffed or in glass jars. It may have Secret Passage. |
| 3 | Table with a dry human body. It may have Secret Passage. |
| 4 | Three cells with dead animals. It may have Secret Passage. |
| 5 | Wardrobe with 1d6 Treasures. |
| 6 | Large library of alchemy books. |
| 7 | Large table with 1d6 Treasures. |
| 8 | Table with some books and notes. |
| 9 | Large cauldron with strange liquid. If you drink, roll on the Potion table and find out which potion you just drank. |
| 10 | Well covered by garbage and 1 treasure. |
| 11 | Table with various kitchen items. It may have Secret Passage. |
| 12 | Room with a crown under the bed and a Chest. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Sewn Ogre (40 HP; 3 dmg; Undead, Weakness) |
| 3 | Floating Evil Eye (20 HP; 2 dmg; Paralyze) |
| 4 | 2 Toxic zombies (4 HP; 3 dmg; Undead, Poison) |
| 5 | Toxic zombie (4 HP; 3 dmg; Undead, Poison) |
| 6 | 1d6 Living Chairs (2 HP; 1 dmg) |
| 7-8 | There are no monsters in this room. |
| 9 | Killer Blob (9 HP; 3 dmg; Regeneration) |
| 10 | 3 Mutant Rats (6 HP; 3 dmg) |
| 11 | 3 Toxic Hounds (5 HP; 3 dmg; Poison) |
| 12 | Aberration (29 HP; 4 dmg; Weakness) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Potions |
|---|---|---|---|
| 1 | Mana Potion (Recovers all Spells) | Distant Place Potion (You appear anywhere in the world) | Mutation Potion (roll in the Mutation table) |
| 2 | Health Potion (Recovers all HP) | Purification Potion (remove a Cursed item) | Goblin Potion (visually transforms into goblin) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Leather breastplate (6 HP; Load up to 3 potions) | Zombie Potion (if dies, returns with 1 HP max) |
| 4 | Bottle with Gold Powder (worth 20 coins in the town) | Alchemist's Mask (3 HP) | Luminescence Potion (equal to 2 torches) |
| 5 | [Roll in the "Wonders" column] | Alchemist King's Sword (1d6 Damage; +3 if it has Poison) | Extra Hand Potion (Create a new arm) |
| 6 | [Roll in the "Potions" column] | Philosophical Stone (Talking Stone; doesn't shut up) | Fool's Potion (Learn 3 Random Basic Spells) |

**Table: Boss (1d6)**

| 1d6 | Dungeon Boss |
|---|---|
| 1 | Making mixtures in bottles, the Undead Alchemist King (20 HP; 5 dmg; Undead, Poison) is desperate. |
| 2 | Made from parts of different creatures, this is the Alchemical Abomination (50 HP; 3 damage; Poison, Paralyze). |
| 3 | Born of a great reaction, the Explosive Blob (60 HP; 2 damage; Poison, Explosivo) expands into the room. |
| 4 | The former alchemist here drank a lot of potions and became the Toxic Beast (40 HP; 3 damage; Poison). |
| 5 | He was a little thief until he came in here. Now he is the Flammable Monster (35 HP; 4 damage; Firebreath). |
| 6 | Making mixtures in bottles, the Undead Alchemist King (30 HP; 5 dmg; Undead, Poison) is desperate. |

**Special Rules**: Any hero or creature that leaves this dungeon will mutate. Roll a die and compare with
the "Common Mutation" column.

**Table: Mutation (1d6)**

| 1d6 | Common Mutation | Rare Mutation | Fatal Mutation |
|---|---|---|---|
| 1 | [Roll a Fatal Mutation] | A poodle's tail appears. | You melt into a goo and die. |
| 2 | All hairs on your body fall out. | An eye sprouts in your navel. | You explode into thousands of pieces. |
| 3 | A huge beard grows on his face. | Your skin becomes thick as stone (+4 HP). | Your skin rots and you become a zombie.* |
| 4 | Your hair and fur change color. | Horns sprout from the head (1d6 Damage). | You get very weak (-6 HP). |
| 5 | You change sex. | Blood turns green (Immune to Poison). | Bubbles sprout all over the body (cannot wear armor). |
| 6 | [Roll a Rare Mutation] | Sprouts an extra arm on a shoulder. | One more toe sprouts (cannot wear boots) |

\* You come back to life with half your maximum hit points. If you die again, you come back with half of
that, and so on.

### Necropolis (page 56)

The place smells of death and decay. Here is a large fenced-in area that appears to have been a large
cemetery, covered by headstones and mausoleums. In the center is a stone structure with the name of the
place carved above the heavy metal double doors. When you open it, the smell is stronger and a long, dark
staircase leads straight down. At the end of this staircase is a metal door.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Small room. |
| 2 | Corridor with two other doors. | Medium size room with another door. | Medium size room. |
| 3 | Corridor with two other doors. | Wide room with two other doors. | Big room. |
| 4 | Corridor with three other doors. | Wide room with two other doors. | Large hall with pillars. |
| 5 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | You have activated a Trap! |
| 3 | Found a hidden Chest! |
| 4 | Found a hidden Chest! |
| 5 | Passage to a Staircase. |
| 6 | Passage to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade descends from the ceiling and cuts off your head. |
| 2 | Raise 1d6 Skeleton Soldiers (4 HP; 2 dmg; Undead). |
| 3 | Raise 1d6 Skeleton Soldiers (4 HP; 2 dmg; Undead). |
| 4 | A cage falls on you. You are trapped and need to spend 1d6 torches to get out. |
| 5 | A dart hits you (damage 1). |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Empty sarcophagus with your name on it. |
| 3 | Several pots with dead plants. |
| 4 | Texts carved across the floor. It may have Secret Passage. |
| 5 | Human bones everywhere. It may have Secret Passage. |
| 6 | Bone pile and 1d6 coins. |
| 7 | Sarcophagus with Chest inside. |
| 8 | Various wooden coffins. It may have Secret Passage. |
| 9 | Skulls walls. It may have Secret Passage. |
| 10 | Dozens of melted candles everywhere. It may have Secret Passage. |
| 11 | Broken statue of a person. It may have Secret Passage. |
| 12 | Treasure Room with 2d6 Treasures. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Lich (22 HP; 6 dmg; Necromancy, Undead) |
| 3 | Ghost King (10 HP; 4 dmg; Intangible) |
| 4 | Bone Golem (20 HP; 5 dmg; Undead) |
| 5 | 2 Living Armor (8 HP; 3 dmg) |
| 6 | 2 Skeleton Soldiers (4 HP; 2 dmg; Undead) |
| 7-8 | There are no monsters in this room. |
| 9 | 2 Living Armor (8 HP; 3 dmg) |
| 10 | Giant Spider (10 HP; 4 dmg; Paralyze) |
| 11 | 2 Giant Spiders (10 HP; 4 dmg; Paralyze) |
| 12 | Queen of the Blade Hands (18 HP; 10 dmg) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Mana Potion (Recovers all Spells) | Crown of the Beheaded Prince (Don't die in blade traps) | Fool's Potion (Learn 3 Random Basic Spells) |
| 2 | Health Potion (Recovers all HP) | Luck Potion (Ignore the next activated Trap) | Dwarf King's Helm (11 HP) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Fury Potion (+2 damage until end of combat) | Breastplate of the Little Ones (13 HP) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Sapphire of Magic (Learn a Random Basic Spell) | Scythe of Destruction (1d6+2 Damage) |
| 5 | [Roll in the "Wonders" column] | Durability Ruby (Attach to an armor for +2 HP) | Vampiric Trident (1d6+2 Damage; Two-handed; Restores 1 HP with each attack) |
| 6 | [Roll in the "Magic Item" column] | Enchantment Ruby (Attach to Armor for +1 Damage) | Vorpal Battle Ax (1d6+1 Damage; Kills instantly in a '6') |

**Table: Boss** — roll three dice and compare each column:

| 1d6 | Part 1 | Part 2 | Part 3 |
|---|---|---|---|
| 1 | Colossal (+30 HP) | Animal (20 HP; 3 dmg) | of Death (Deathtouch) |
| 2 | Giant (+15 HP) | Skeleton (12 HP; 4 dmg; Undead) | of the Blades (damage +2) |
| 3 | Monstrous (Damage +2) | Zombie (15 HP; 5 dmg; Undead) | from Hell (Firebreath) |
| 4 | Poisonous (Poison) | Ghost (12 HP; 4 dmg; Intangible) | from the Ice (Paralyze) |
| 5 | Dying (-5 HP) | Necromancer (20 HP; 4 dmg; Necromancy) | of Ancient Times (+30 HP) |
| 6 | Stone (Stoneskin) | Lich (25 HP; 6 dmg; Necromancy, Undead) | Forgotten by the Gods (+40 HP) |

Combine Part 1 + Part 2 + Part 3 to build the boss's full name, HP, damage, and abilities.

**Special Rules**: Once you defeat the Dungeon Boss, in addition to the 2d6 Treasures, you've found one
of the Forgotten Hallows (roll below).

**Table: Forgotten Hallows (1d6)**

| 1d6 | Forgotten Hallows |
|---|---|
| 1 | Magic Stone Dog (Will always follow you; 4 HP and deals +2 damage). |
| 2 | Dagger of Souls (1d6-1 Damage; If killing an Intangible creature, it increases its damage by +1) |
| 3 | Giant King's Shoulderpads (10 HP) |
| 4 | Monster Tamer Boots (6 HP; Gain +1 on animal tame rolls) |
| 5 | Halberd of the Infernal Soldiers (1d6+4 Damage; Two-handed; +3 against creatures with Firebreath) |
| 6 | Sword of the Nameless Gods (1d6+4 Damage; Restores 1 HP for each Undead destroyed) |

### Entrails (page 58)

*Unique dungeon — once placed on the map it cannot appear again.*

You see a huge, monstrous mass of shapeless flesh and mucus. It looks like a colossal creature that came
from any other world, maybe from space or a nightmare. You find an entrance that appears to be an open
mouth. You just see a disgusting, dark tunnel into the creature.

**Table: Segments (1d6)**

| 1d6 | Following a Wide Tunnel | Following a Narrow Tunnel |
|---|---|---|
| 1 | If 3 large organs have already appeared, this is the dungeon exit. Otherwise, the tunnel goes on. | It ends up in a small Organ. |
| 2 | Wide tunnel follows. There is a narrow tunnel on the side. | It ends up in a big Organ. |
| 3 | Wide tunnel follows. There is a narrow tunnel on the side. | It ends up in a big Organ. |
| 4 | Wide tunnel follows. There is a narrow tunnel on the side. | A small Organ. Narrow tunnel goes on. |
| 5 | Arrives in a big Organ. Wide tunnel goes forward. | Narrow tunnel goes on. |
| 6 | Arrives in a big Organ. Wide tunnel goes forward. | The tunnel splits into two narrow tunnels. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | A Treasure in the midst of a lot of mucus! |
| 4 | A Treasure in the midst of a lot of mucus! |
| 5 | You found a Narrow Tunnel. |
| 6 | You found a Narrow Tunnel. |

*(As printed, rows 3-4 read identically ("A Treasure...") and row 2 reads "There's nothing here."; row 5-6
both "You found a Narrow Tunnel." — transcribed exactly as shown in the book.)*

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | The walls close quickly (8 damage). |
| 2 | Acid squirts from the pores of the walls corrodes a piece of armor you're wearing (your choice). |
| 3 | Acid squirts from the pores of the walls corrodes a piece of armor you're wearing (your choice). |
| 4 | Acid squirts from the pores of the walls corrodes a piece of armor you're wearing (your choice). |
| 5 | Everything moves but nothing happens. |
| 6 | Everything moves but nothing happens. |

**Table: Room Content ("Organ") (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | Everything is awash in blue liquid. Spend 1 more torch to get out of this organ. |
| 3 | A Chest hidden in the middle of the gray goo. |
| 4 | This is a dry organ with pores in the walls. |
| 5 | Tentacles swing from the ceiling. |
| 6 | This organ has thick, wrinkled walls. |
| 7 | Translucent sticky goops on all sides. It may have Secret Passage. |
| 8 | This organ appears to be like the tunnel. |
| 9 | Looks like someone has been living in this organ. There is a camp with some 1d6 Treasures. |
| 10 | Translucent sticky goops on all sides. It may have Secret Passage. |
| 11 | This organ is covered in a dark, stinking ooze. You can see some bones of assorted creatures inside this goo. |
| 12 | You see 2d6 Treasures strewn among a sort of whitish mucus. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Poorly Digested Birthday Cake (80 HP; 5 dmg; Weakness) |
| 3 | Giant Tick (17 HP; 7 dmg; Regeneration) |
| 4 | Gut Cleaner Orc (6 HP; 2 dmg; Loot) |
| 5 | Carrion Worm (18 HP; 4 dmg; Weakness) |
| 6 | 2d6 Hemogoblin (1 HP; 1 dmg; Explosive) |
| 7-8 | There are no monsters in this room. |
| 9 | Giant Roundworm (9 HP; 2 dmg) |
| 10 | 2 Giant Roundworms (9 HP; 2 dmg) |
| 11 | 3 Giant Roundworms (9 HP; 2 dmg) |
| 12 | 4 Giant Roundworms (9 HP; 2 dmg) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Health Potion (Recovers all HP) | Luck Potion (Ignore the next activated Trap) | [Armor] of Strength (+1 Damage) |
| 2 | Health Potion (Recovers all HP) | Fury Potion (+2 damage until end of combat) | [Armor] of the infernal devil (+3 HP) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Purification Potion (remove a Cursed item) | [Weapon] of Destruction (+2 Damage) |
| 4 | Lost jewel (worth 2d6 Coins in the town) | Sapphire of Magic (Learn a Random Basic Spell) | [Weapon] of the Last Sigh (+4 damage if you have 1 HP) |
| 5 | [Roll in the "Wonders" column] | Durability Ruby (Attach to an armor for +2 HP) | Cosmic [Weapon] (If it drops 1, it opens a Portal) |
| 6 | [Roll in the "Magic Item" column] | Enchantment Ruby (Attach to Armor for +1 Damage) | Vorpal [Weapon] (Kills instantly when get '6' on the die) |

**Special Rules**:
- This dungeon does not have a Final Room or Dungeon Boss.
- **Tunnels**: Work like corridors but you can't see the rest of it. Each tunnel segment continues the
  previous. There are two types of Tunnels (narrow and wide) and must be treated differently (per the
  Segment column). In a **Wide Tunnel** you must roll to add Monster but not Content. **Narrow Tunnels**
  have nothing.
- **Organ**: A place where there is more room to the sides and up. Works like Rooms in the basic
  dungeons. You need to roll to add Monster as well as Content.
- **Backflow**: For every 4 torches spent, roll on the table below.

**Table: Backflow (1d6)**

| 1d6 | Backflow |
|---|---|
| 1 | The walls close quickly (8 damage). |
| 2 | Acid squirts from the pores of the walls corrodes a piece of armor you're wearing (your choice). |
| 3 | A creature looking like a white amoeba carrying a halberd appears out of nowhere! White Globule (10 HP; Damage 3; Regeneration). |
| 4 | (same as 3 — White Globule appears) If defeated you found a Chest. |
| 5 | Everything moves but nothing happens. |
| 6 | A Portal appears on one of the walls of the organ wherever you are. |

### Mega Dungeon (page 60)

*Unique dungeon — once placed on the map it cannot appear again. Goes on for infinite levels.*

Hidden amidst the ruins of an ancient castle is a huge and imposing staircase that leads down to the
earth. Plants and slime cover each step. At the end of this staircase is a large, heavy metal door that
is completely rusted. Even very old, it seems that many creatures have passed through this door recently.

**Table: Segments (1d6)**

| 1d6 | Open from a Staircase | Open from a Corridor | Open from a Room |
|---|---|---|---|
| 1 | Corridor with another door. | Small room with another door. | Corridor with another door. |
| 2 | Corridor with another door. | Medium size room with another door. | Medium size room with another door. |
| 3 | Corridor with two other doors. | Medium size room with two doors. | Medium size room with another door. |
| 4 | Corridor with two other doors. | Wide room with two other doors. | Wide room with another door. |
| 5 | Corridor with three other doors. | Wide room with two other doors. | Big room with another door. |
| 6 | Corridor with three other doors. | Staircase with a door in the end. | Staircase with a door in the end. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | There's nothing here. |
| 4 | Found a hidden Chest! |
| 5 | Found a hidden Chest! |
| 6 | Passage to a Staircase. |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | A blade cuts off your head. |
| 2 | A blade cuts off one of your hands. |
| 3 | Acid squirts from the ceiling destroying a piece of armor you're wearing. |
| 4 | Acid squirts from the ceiling destroying a piece of armor you're wearing. |
| 5 | Spears come out of the ground (Damage 8). |
| 6 | You hear a click, but nothing happens. |

**Table: Room Content (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | A Portal |
| 3 | Crates with food (1d6 Provisions). It may have Secret Passage. |
| 4 | Stacked bodies of common monsters from another faction. When entering, roll a die. If it's 1, one of these monsters was still alive and will attack you. |
| 5 | Room with Faction banners and trophies. It may have Secret Passage. |
| 6 | Marks of a battle. 1d6 Treasures. |
| 7 | Empty room. It may have Secret Passage. |
| 8 | A large faction banner on a wall. It may have Secret Passage. |
| 9 | Crate with 1d6 Treasures. |
| 10 | Table and two chairs. It may have Secret Passage. |
| 11 | Adventurer corpse with 2 Treasures. |
| 12 | Room with a crown under the bed and a Chest. |

**Table: Monsters (2d6)** — monster identity depends on which Faction dominates the level (see Factions
table below):

| 2d6 | Monsters |
|---|---|
| 2 | Faction Mercenary Ogre (40 HP; 3 dmg; Weakness) |
| 3 | [Rare Monster] (see Factions table) |
| 4 | [Unusual Monster] (see Factions table) |
| 5 | Floating Evil Eye (20 HP; 2 dmg; Paralyze) |
| 6 | [Common Monster] (see Factions table) |
| 7-8 | There are no monsters in this room. |
| 9 | [Common Monster] (see Factions table) |
| 10 | Giant Spider (10 HP; 4 dmg; Paralyze) |
| 11 | [Unusual Monster] (see Factions table) |
| 12 | [Rare Monster] (see Factions table) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | Mana Potion (Recovers all Spells) | Foot fungus (Cursed; cannot wear boots) | Goblin Ring (Cursed; intensified flatulence) |
| 2 | Health Potion (Recovers all HP) | Orc Helmet (6 HP) | Elf Lord's Saber (1d6 dmg; +2 against Goblins) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Fire Cristal (Break it and light it 1 torch) | General Orc's gladius (1d6 Damage; +2 against Elf or Dwarf) |
| 4 | Valuable jewel (worth 2d6 x 10 Coins in the town) | Meal Mushroom (Eat and ignore 2 provisions) | Draconic Breastplate (10 HP; Immune to Firebreath) |
| 5 | [Roll in the "Wonders" column] | Durability Ruby (Attach to an armor for +2 HP) | Staff of the God of Death (1d6 Damage; +3 against Undead) |
| 6 | [Roll in the "Magic Item" column] | Enchantment Ruby (Attach to Armor for +1 Damage) | Last Hero's Greatsword (1d6+4 Damage; Two-handed) |

**Special Rules**: This dungeon does not have a Final Room or Dungeon Boss. It goes on for infinite
levels. Each level is dominated by a faction. Whenever you reach a new level, roll on the table below to
determine which Faction dominates the place. Changing the monsters you can find.

**Table: Factions (1d6)**

| 1d6 | Faction | Common Monster | Unusual Monster | Rare Monster |
|---|---|---|---|---|
| 1 | The Bloody Court | 3 Cursed Elves (5 HP; 2 dmg; Loot) | 2 Hell Hounds (15 HP; 4 dmg; Firebreath) | Vampire Elven King (23 HP; 4 dmg; Regen) |
| 2 | The Flatulents | 1d6 Goblins (3 HP; 1 dmg; Explosivo) | Troll (20 HP; 4 dmg; Regen) | Goblin King (20 HP; 1 dmg; Explosivo) |
| 3 | Green Legion | 2 Orc Soldiers (7 HP; 3 dmg; Loot) | Orc General (9 HP; 5 dmg; Horda) | Orc War Hero (19 HP; 5 dmg; Horda) |
| 4 | Fungi Kingdom | 3 Fungoid (4 HP; 2 dmg; Regeneration) | Fungomaster (20 HP; 2 dmg; Regen) | Giant Mushroom (100 HP; 6 dmg; Paralyze) |
| 5 | Devotees of Death | 1d6 skeletons (4 HP; 1 dmg; Undead) | Cleric of Death (10 HP; 5 dmg; Necrom.) | Avatar of Death (50 HP; 6 dmg; Deathtouch) |
| 6 | Cult of the Dragon | 3 Dragon Cultists (5 HP; 2 dmg; Loot) | Dragon (30 HP; 7 dmg; Firebreath) | Ancient Dragon (70 HP; 8 dmg; Firebreath) |

### Cave (page 62)

Entering through the large rock-covered opening, the cave extends into darkness. The walls are molded by
time and creeping creatures. Stalactites and stalagmites become more frequent as the air gets colder and
the darkness more frightening. Your only way is by following the Wide Tunnel.

**Table: Segments (1d6)**

| 1d6 | Following a Wide Tunnel | Following a Narrow Tunnel |
|---|---|---|
| 1 | The tunnel narrows. | It ends up in a small Grotto. |
| 2 | Wide tunnel follows. There is a narrow tunnel on the side. | It ends up in a big Grotto. |
| 3 | Wide tunnel follows. There is a narrow tunnel on the side. | A small Grotto. Narrow tunnel goes on. |
| 4 | A big Grotto. Wide tunnel goes forward. | A big Grotto. Narrow tunnel goes on. |
| 5 | Wide tunnel goes forward. | Narrow tunnel goes on. |
| 6 | Wide tunnel goes forward. | Narrow tunnel goes on. |

**Table: Secret Passage (1d6)**

| 1d6 | Secret Passage |
|---|---|
| 1 | You have activated a Trap! |
| 2 | There's nothing here. |
| 3 | A buried Chest! |
| 4 | A buried Chest! |
| 5 | A door that leads to a Prison. |
| 6 | A hole to a new cave complex below (Wide Tunnel). |

**Table: Trap (1d6)**

| 1d6 | Trap |
|---|---|
| 1 | Collapse (10 damage). |
| 2 | Collapse (9 damage). |
| 3 | Collapse (8 damage). |
| 4 | A stalactite hits you (5 damage). |
| 5 | A tremor, but nothing happens. |
| 6 | A tremor, but nothing happens. |

**Table: Room Content ("Grotto") (2d6)**

| 2d6 | Room Content |
|---|---|
| 2 | It's all flooded. Spend 1 torch to get out of this cave. |
| 3 | A Chest hidden behind some rocks. |
| 4 | A small waterfall falls from the ceiling and descends through the floor towards the tunnel beyond. It may have Secret Passage. |
| 5 | A river runs through this cave, but it is small. It may have Secret Passage. |
| 6 | High ceiling dripping water. |
| 7 | Pointed stalagmites in the ceiling. It may have Secret Passage. |
| 8 | A Treasure hidden behind some rocks. |
| 9 | An abandoned camp with a Treasure. |
| 10 | Many rocks on the way. |
| 11 | A hole in the ground appears to lead to a Wide Tunnel in a new complex below. |
| 12 | A Chest strangely left on a rock. |

**Table: Monsters (2d6)**

| 2d6 | Monsters |
|---|---|
| 2 | Fungomaster (20 HP; 2 damage; Loot, Regeneration) |
| 3 | 5 Fungoid (4 HP; 2 damage; Loot, Regeneration) |
| 4 | 3 Fungoid (4 HP; 2 damage; Loot, Regeneration) |
| 5 | 1d6 Goblins (3 HP; 1 damage; Explosive) |
| 6 | 1d6 Bats (1 HP; 1 damage) |
| 7-8 | There are no monsters in this room. |
| 9 | Brown bear (13 HP; 4 damage) |
| 10 | Giant Spider (10 HP; 4 damage; Paralyze) |
| 11 | 3 Bandids [sic] (5 HP; 2 damage; Loot) |
| 12 | 3 Giant Spiders (10 HP; 4 damage; Paralyze) |

**Table: Reward (1d6)**

| 1d6 | Treasure | Wonders | Magic Item |
|---|---|---|---|
| 1 | [Roll in the "Weapon" table] | Fragrant Mushroom (Eat and recover 2 HP) | [Armor] of Laughter (Cursed; Cannot Move Silently) |
| 2 | Health Potion (Recovers all HP) | Special moldy bread (Same as 3 provisions) | [Armor] of bad luck (Cursed; Reroll the '6' on attacks) |
| 3 | Magic Scroll (Random Basic Magic; Use once) | Goblin Whistle (Goblins flee on hearing) | Magic Wood Puppet (Like a Torchbearer) |
| 4 | Lost jewel (worth 2d6 Coins in the town) | Master key (Open any door) | Folding Boat (can move in water) |
| 5 | [Roll in the "Wonders" column] | Rusty Glaive (Two-handed; 1d6+3 Damage) | [Weapon] of the Nameless Wizard (Has an Advanced Magic) |
| 6 | [Roll in the "Magic Item" column] | Escape Dust (Spend and flee a battle) | [Weapon] of the Last Sigh (+4 damage if you have 1 HP) |

**Table: Weapon (1d6)**

| 1d6 | Weapon |
|---|---|
| 1 | Club (1d6-1 Damage) |
| 2 | Pickaxe (1d6 Damage) |
| 3 | Cleaver (1d6 Damage) |
| 4 | Rapier (1d6+1 Damage) |
| 5 | Mace (1d6+1 Damage) |
| 6 | Heavy Ax (1d6+2 Damage; Two-handed) |

**Table: Armor (1d6)** — identical shape to Palace's Armor table (Ring 0/Bracelets 2/Boots 3/Shoulderpads
3/Helm 4/Breastplate 10).

**Special Rules**:
- This dungeon does not have a Final Room or Dungeon Boss.
- **Tunnels**: Work like corridors but you can't see the rest of it. Each tunnel segment continues the
  previous one. There are two types of Tunnels (narrow and wide), treated per the Segment column. In a
  **Wide Tunnel** you must roll to add Monster but not Content. **Narrow Tunnels** have nothing.
- **Grotto**: A place in the cave with more room to the sides and up. Works like Rooms in the basic
  dungeons — roll to add Monster as well as Content.
- **Mine**: If it is a "Mine" type, there is a railroad going down the entire Wide Tunnel. You can drive
  down the track with a cart, making an attack of 1d6+3 damage to any monsters in the way (stop the cart
  if the monster hasn't died).
- **Underwater Cave**: If it is an "Underwater Cave" type and you rolled 9 or more on the Monster table,
  you have found a Killer Octopus (50 HP; 5 damage; Paralyze). If you defeat him you find a Chest. All
  Magic Items found here should be rolled on the Mega Dungeon table (page 61).
- **Volcanic Cave**: If it is a "Volcanic Cave" type and you rolled 9 or more on the Monster table, you
  have found a Magma Monster (30 HP; 3 damage; Firebreath). If you defeat him you find a Chest. All Magic
  Items found here should be rolled on the Mega Dungeon table (page 61).

---

## The Graveyard (play-sheet, repeated at end of Expanded World)

Write down the characters that died trying to explore these dungeons: **Name**, **Dungeon**, **Cause of
Death** (blank table for players to fill in during play).
