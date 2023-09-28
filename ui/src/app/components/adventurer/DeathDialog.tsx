import React, { useEffect, useState } from "react";
import TwitterShareButton from "../buttons/TwitterShareButtons";
import useAdventurerStore from "../../hooks/useAdventurerStore";
import useLoadingStore from "../../hooks/useLoadingStore";
import { Button } from "../buttons/Button";
import useUIStore from "../../hooks/useUIStore";
import { getRankFromList, getOrdinalSuffix } from "../../lib/utils";
import { appUrl } from "@/app/lib/constants";
import { getAdventurerByXP } from "@/app/hooks/graphql/queries";
import useCustomQuery from "@/app/hooks/useCustomQuery";
import { NullAdventurer, Adventurer } from "@/app/types";
import { useQueriesStore } from "@/app/hooks/useQueryStore";
import GlitchEffect from "../animations/GlitchEffect";
import PixelatedImage from "../animations/PixelatedImage";
import { getDeathMessageByRank } from "../../lib/utils";
import Image from "next/image";

export const DeathDialog = () => {
  // const [rank, setRank] = useState<number | null>(null);
  const rank = 1;
  const deathMessage = useLoadingStore((state) => state.deathMessage);
  const setDeathMessage = useLoadingStore((state) => state.setDeathMessage);
  const adventurer = useAdventurerStore((state) => state.adventurer);
  const setAdventurer = useAdventurerStore((state) => state.setAdventurer);
  const showDeathDialog = useUIStore((state) => state.showDeathDialog);

  const { data, refetch, setData } = useQueriesStore();

  useCustomQuery("adventurersByXPQuery", getAdventurerByXP, undefined);

  const handleSortXp = (xpData: any) => {
    const copiedAdventurersByXpData = xpData?.adventurers.slice();

    const sortedAdventurersByXPArray = copiedAdventurersByXpData?.sort(
      (a: Adventurer, b: Adventurer) => (b.xp ?? 0) - (a.xp ?? 0)
    );

    const sortedAdventurersByXP = { adventurers: sortedAdventurersByXPArray };
    return sortedAdventurersByXP;
  };

  useEffect(() => {
    refetch("adventurersByXPQuery", undefined)
      .then((adventurersByXPdata) => {
        const sortedAdventurersByXP = handleSortXp(adventurersByXPdata);
        setData("adventurersByXPQuery", sortedAdventurersByXP);
        const rank = getRankFromList(
          adventurer?.id ?? 0,
          sortedAdventurersByXP?.adventurers ?? []
        );
        // setRank(rank + 1);
      })
      .catch((error) => console.error("Error refetching data:", error));
  }, []);

  return (
    <>
      <div className="top-0 left-0 fixed text-center h-full w-full z-40">
        {rank! <= 50 ? (
          <PixelatedImage src={"/scenes/intro/skulls.png"} pixelSize={10} />
        ) : (
          <Image
            src={"/scenes/intro/skulls.png"}
            alt="skull"
            className="absolute object-cover"
            fill
          />
        )}
        <div className="absolute inset-0 bg-black opacity-50"></div>

        <div className="flex flex-col gap-4 sm:gap-10 items-center justify-center z-10 p-10 sm:p-20 h-full">
          <div className="flex flex-col gap-5 items-center justify-center z-10 self-center ">
            {rank! <= 50 ? (
              <GlitchEffect />
            ) : (
              <h1 className="text-red-500 text-6xl">YOU DIED!</h1>
            )}
            <span className="text-lg sm:text-3xl text-red-500">
              {deathMessage}
            </span>
            <span className="flex flex-col gap-2 text-lg sm:text-4xl">
              <span className="text-terminal-yellow">
                {getDeathMessageByRank(rank!)}
              </span>{" "}
              <span className="text-4xl">
                <span className="text-terminal-yellow">{adventurer?.name}</span>{" "}
                died{" "}
                <span className="text-terminal-yellow">
                  {getOrdinalSuffix(rank! ?? 0)}
                </span>{" "}
                with{" "}
                <span className="text-terminal-yellow">
                  {adventurer?.xp} XP
                </span>
              </span>
            </span>
            <span className="sm:text-2xl">
              Share your score. Continue the journey with another adventurer.
            </span>
          </div>
          <TwitterShareButton
            text={`RIP ${adventurer?.name}, who died at ${rank} place on the #LootSurvivor leaderboard.\n\nThink you can beat ${adventurer?.xp} XP? Enter here and try to survive: ${appUrl}\n\n@lootrealms #Starknet #Play2Die #LootSurvivor`}
          />
          <Button
            onClick={() => {
              showDeathDialog(false);
              setDeathMessage(null);
              setAdventurer(NullAdventurer);
            }}
            className="z-10"
          >
            Play Again
          </Button>
        </div>
      </div>
    </>
  );
};
