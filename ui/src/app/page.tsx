"use client";
import { useAccount, useConnectors } from "@starknet-react/core";
import { useState, useEffect, useMemo } from "react";
import { Button } from "./components/Button";
import HorizontalKeyboardControl, {
  ButtonData,
} from "./components/HorizontalMenu";
import Actions from "./components/Actions";
import Marketplace from "./components/Marketplace";
import Adventurer from "./components/Adventurer";
import Beast from "./components/Beast";
import { displayAddress, padAddress } from "./lib/utils";
import Inventory from "./components/Inventory";
import TransactionHistory from "./components/TransactionHistory";
import TransactionCart from "./components/TransactionCart";
import Upgrade from "./components/Upgrade";
import Intro from "./components/Intro";
import {
  AddDevnetEthButton,
  MintEthButton,
} from "./components/DevnetConnectors";
import Leaderboard from "./components/Leaderboard";
import { TxActivity } from "./components/TxActivity";
import useLoadingStore from "./hooks/useLoadingStore";
import useAdventurerStore from "./hooks/useAdventurerStore";
import usePrevious from "use-previous";
import { useLazyQuery, useQuery } from "@apollo/client";
import {
  getAdventurerById,
  getAdventurersInList,
  getAdventurersInListByXp,
  getBattleByTxHash,
  getBeasts,
  getLastDiscovery,
  getAdventurerByXP,
  getDiscoveries,
  getLatestDiscoveries,
  getLastBattleByAdventurer,
  getBattlesByAdventurer,
  getBattlesByBeast,
  getDiscoveryByTxHash,
  getAdventurersByOwner,
  getLatestMarketItems,
  getLatestMarketItemsNumber,
  getBeastById,
  getTopScores,
  getItemsByAdventurer,
  getUnclaimedItemsByAdventurer,
} from "./hooks/graphql/queries";
import useUIStore from "./hooks/useUIStore";
import useIndexerStore from "./hooks/useIndexerStore";
import useTransactionCartStore from "./hooks/useTransactionCartStore";
import { CSSTransition } from "react-transition-group";
import { NotificationDisplay } from "./components/NotificationDisplay";
import { useMusic } from "./hooks/useMusic";
import { testnet_addr } from "./lib/constants";
import { Menu, NullAdventurer } from "./types";
import useCustomQuery from "./hooks/useCustomQuery";
import { useQueriesStore } from "./hooks/useQueryStore";
import Profile from "./components/Profile";
import { DeathDialog } from "./components/DeathDialog";
import { Encounters } from "./components/Encounters";
import { Maintenance } from "./components/Maintenance";
import Guide from "./components/Guide";

export default function Home() {
  const { disconnect } = useConnectors();
  const { account } = useAccount();
  const [isMuted, setIsMuted] = useState(false);

  const hash = useLoadingStore((state) => state.hash);
  const type = useLoadingStore((state) => state.type);
  const pendingMessage = useLoadingStore((state) => state.pendingMessage);
  const notificationData = useLoadingStore((state) => state.notificationData);
  const showNotification = useLoadingStore((state) => state.showNotification);
  const adventurer = useAdventurerStore((state) => state.adventurer);
  const setAdventurer = useAdventurerStore((state) => state.setAdventurer);
  const calls = useTransactionCartStore((state) => state.calls);
  const connected = useUIStore((state) => state.connected);
  const setConnected = useUIStore((state) => state.setConnected);
  const onboarded = useUIStore((state) => state.onboarded);
  const screen = useUIStore((state) => state.screen);
  const setScreen = useUIStore((state) => state.setScreen);
  const handleOnboarded = useUIStore((state) => state.handleOnboarded);
  const dialog = useUIStore((state) => state.dialog);
  const showDialog = useUIStore((state) => state.showDialog);
  const setIndexer = useIndexerStore((state) => state.setIndexer);
  const upgrade = adventurer?.upgrading;

  const { data, isDataUpdated, refetch, refetchFunctions } = useQueriesStore();

  const updatedAdventurer = data.adventurerByIdQuery
    ? data.adventurerByIdQuery.adventurers[0]
    : NullAdventurer;

  useEffect(() => {
    if (updatedAdventurer?.id > 0) {
      setAdventurer(updatedAdventurer);
    }
  }, [updatedAdventurer]);

  const hasBeast = !!adventurer?.beastId;

  const playState = useMemo(
    () => ({
      isInBattle: hasBeast,
      isDead: false, // set this to true when player is dead
      isMuted: isMuted,
    }),
    [hasBeast, isMuted]
  );

  const { play, stop } = useMusic(playState, {
    volume: 0.5,
    loop: true,
  });

  useEffect(() => {
    // play();

    return () => {
      stop();
    };
  }, [play, stop]);

  const [menu, setMenu] = useState<Menu[]>([
    {
      id: 1,
      label: "Start",
      screen: "start",
    },
  ]);

  const adventurers = data.adventurersByOwnerQuery
    ? data.adventurersByOwnerQuery.adventurers
    : [];

  useEffect(() => {
    if (!adventurer || adventurer?.health == 0) {
      setScreen(menu[0].screen);
    }
  }, [adventurer]);

  useEffect(() => {
    if (data.battlesByTxHashQuery && isDataUpdated["battlesByTxHashQuery"]) {
      if (
        Array.isArray(data.battlesByTxHashQuery.battles) &&
        data.battlesByTxHashQuery.battles.some(
          (data: any) => data.attacker == "Beast" && data.targetHealth == 0
        )
      ) {
        showDialog(true);
      }
    }
    // handle dead by discovering obstacle
    if (
      data.discoveryByTxHashQuery &&
      isDataUpdated["discoveryByTxHashQuery"]
    ) {
      if (
        data.discoveryByTxHashQuery.discoveries[0]?.discoveryType ==
          "Obstacle" &&
        adventurer?.health == 0
      ) {
        showDialog(true);
      }
    }
    if (pendingMessage && isDataUpdated["adventurerByIdQuery"]) {
      if (
        (pendingMessage as string[]).includes("Equipping") &&
        adventurer?.health == 0
      ) {
        showDialog(true);
      }
    }
  }, [
    showNotification,
    data.battlesByTxHashQuery,
    data.discoveryByTxHashQuery,
  ]);

  useEffect(() => {
    if (!account?.address) {
      setConnected(false);
    }
  }, [account]);

  const goerli_graphql =
    "https://survivor-indexer.bibliothecadao.xyz:8081/goerli-graphql";
  const devnet_graphql =
    "https://survivor-indexer.bibliothecadao.xyz:8081/devnet-graphql";

  useEffect(() => {
    setIndexer(
      (account as any)?.provider?.baseUrl == testnet_addr ||
        (account as any)?.baseUrl == testnet_addr
        ? devnet_graphql
        : goerli_graphql
    );
  }, [account]);

  useEffect(() => {
    if (onboarded) {
      let newMenu: Menu[] = [
        {
          id: 1,
          label: "Start",
          screen: "start",
        },
      ];

      if (adventurer) {
        newMenu = [
          ...newMenu,
          {
            id: 2,
            label: "Actions",
            screen: "actions",
            disabled: hasBeast || upgrade || adventurer.health == 0,
          },
          {
            id: 3,
            label: "Market",
            screen: "market",
            disabled: hasBeast || upgrade || adventurer.health == 0,
          },
          {
            id: 4,
            label: "Inventory",
            screen: "inventory",
            disabled: upgrade || adventurer.health == 0,
          },
          {
            id: 5,
            label: "Beast",
            screen: "beast",
            disabled: upgrade || adventurer.health == 0,
          },
          {
            id: 6,
            label: "Leaderboard",
            screen: "leaderboard",
          },
          {
            id: 7,
            label: "Upgrade",
            screen: "upgrade",
            disabled: !upgrade,
          },
          {
            id: 8,
            label: "Encounters",
            screen: "encounters",
          },
          {
            id: 9,
            label: "Guide",
            screen: "guide",
          },
        ];
      }
      setMenu(newMenu);
    }
  }, [adventurer, account, onboarded]);

  useEffect(() => {
    if (!onboarded) {
      if (adventurers.length == 0) {
        setMenu([
          {
            id: 1,
            label: "Start",
            screen: "start",
          },
        ]);
        setScreen(menu[0].screen);
      } else if (
        adventurers.length == 1 &&
        adventurer?.id &&
        adventurer?.xp == 0 &&
        !adventurer.beastId
      ) {
        setMenu([
          {
            id: 1,
            label: "Actions",
            screen: "actions",
          },
        ]);
        setScreen("actions");
      } else if (
        adventurers.length == 1 &&
        adventurer?.xp == 0 &&
        adventurer.beastId
      ) {
        setMenu([
          {
            id: 1,
            label: "Beast",
            screen: "beast",
          },
        ]);
        setScreen("beast");
      } else {
        handleOnboarded();
        refetch("adventurersByOwnerQuery");
      }
    }
  }, [onboarded, adventurer, account]);

  useEffect(() => {
    if (upgrade) {
      setScreen("upgrade");
    }
  }, [upgrade]);

  // fetch adventurers on app start and account switch
  useEffect(() => {
    refetch("adventurersByOwnerQuery");
  }, [account]);

  console.log(data);

  return (
    // <Maintenance />
    <main
      className={`min-h-screen container mx-auto flex flex-col p-4 sm:p-10 overflow-hidden`}
    >
      {connected ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between w-full">
            <h1 className="glitch">Loot Survivor</h1>
            <div className="flex flex-row self-end gap-2 flex-wrap">
              <TxActivity />
              <Button onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              {account && calls.length > 0 && <TransactionCart />}
              {account && <TransactionHistory />}
              {((account as any)?.provider?.baseUrl == testnet_addr ||
                (account as any)?.baseUrl == testnet_addr) && (
                <AddDevnetEthButton />
              )}
              {((account as any)?.provider?.baseUrl == testnet_addr ||
                (account as any)?.baseUrl == testnet_addr) && <MintEthButton />}
              {account && (
                <Button onClick={() => disconnect()}>
                  {displayAddress(account.address)}
                </Button>
              )}
            </div>
          </div>
          <div className="w-full h-6 my-2 bg-terminal-green" />
          <CSSTransition
            in={
              showNotification &&
              Boolean(notificationData) &&
              (typeof notificationData === "object"
                ? "data" in notificationData
                  ? notificationData.data.length > 0
                  : true
                : true)
            }
            timeout={500}
            classNames="notification"
            unmountOnExit
          >
            <div className="fixed top-1/16 left-3/8 sm:w-1/4 border rounded-lg border-terminal-green bg-terminal-black z-50">
              <NotificationDisplay
                type={type}
                notificationData={notificationData}
                hasBeast={hasBeast}
              />
            </div>
          </CSSTransition>

          {dialog && <DeathDialog />}

          {account ? (
            <div className="flex-grow w-full">
              <>
                <div className="gap-10 pb-2">
                  <HorizontalKeyboardControl
                    buttonsData={menu}
                    onButtonClick={(value) => {
                      setScreen(value);
                    }}
                  />
                </div>

                {screen === "start" && <Adventurer />}
                {screen === "actions" && <Actions />}
                {screen === "market" && <Marketplace />}
                {screen === "inventory" && <Inventory />}
                {screen === "beast" && <Beast />}
                {screen === "leaderboard" && <Leaderboard />}
                {screen === "upgrade" && <Upgrade />}
                {screen === "profile" && <Profile />}
                {screen === "encounters" && <Encounters />}
                {screen === "guide" && <Guide />}
              </>
            </div>
          ) : null}
        </>
      ) : (
        <Intro />
      )}
    </main>
  );
}
