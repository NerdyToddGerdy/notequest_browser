import { useState } from "react";
import { CharacterCreationScreen } from "./ui/screens/CharacterCreationScreen/CharacterCreationScreen.tsx";
import { DungeonScreen } from "./ui/screens/DungeonScreen/DungeonScreen.tsx";
import type { CreatedCharacter } from "./data/types.ts";
import { isDungeonBeaten, type DungeonState, type PendingDungeon } from "./engine/dungeonState.ts";

export default function App() {
  const [character, setCharacter] = useState<CreatedCharacter | null>(null);
  const [resumeDungeon, setResumeDungeon] = useState<PendingDungeon | null>(null);
  const [pendingDungeons, setPendingDungeons] = useState<PendingDungeon[]>([]);

  function handleDescend(newCharacter: CreatedCharacter, dungeon: PendingDungeon | null) {
    setCharacter(newCharacter);
    setResumeDungeon(dungeon);
  }

  function handleNewAdventurer() {
    setCharacter(null);
    setResumeDungeon(null);
  }

  // Called whenever a dungeon run ends (death, a voluntary retreat, or "Start a New Dungeon"),
  // with whatever the dungeon looked like at that moment. Beaten or never-entered runs are
  // dropped; everything else is kept (or re-saved, if it was already a resumed run) so a later
  // character can pick up exactly where this one left off.
  function handleLeaveDungeon(runId: string, dungeon: DungeonState, characterName: string) {
    setPendingDungeons((prev) => {
      const withoutCurrent = prev.filter((pd) => pd.id !== runId);
      if (dungeon.levels.length === 0 || isDungeonBeaten(dungeon)) return withoutCurrent;
      return [...withoutCurrent, { id: runId, dungeon, lastCharacterName: characterName }];
    });
  }

  if (character) {
    return (
      <DungeonScreen
        character={character}
        resumeDungeon={resumeDungeon}
        pendingDungeons={pendingDungeons}
        onNewAdventurer={handleNewAdventurer}
        onLeaveDungeon={handleLeaveDungeon}
      />
    );
  }
  return <CharacterCreationScreen pendingDungeons={pendingDungeons} onDescend={handleDescend} />;
}
