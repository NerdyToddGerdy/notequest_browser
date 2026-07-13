import { useState } from "react";
import { CharacterCreationScreen } from "./ui/screens/CharacterCreationScreen/CharacterCreationScreen.tsx";
import { DungeonScreen } from "./ui/screens/DungeonScreen/DungeonScreen.tsx";
import type { CreatedCharacter } from "./data/types.ts";

export default function App() {
  const [character, setCharacter] = useState<CreatedCharacter | null>(null);

  if (character) {
    return <DungeonScreen character={character} />;
  }
  return <CharacterCreationScreen onDescend={setCharacter} />;
}
