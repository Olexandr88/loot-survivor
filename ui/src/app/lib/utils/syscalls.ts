import { InvokeTransactionReceiptResponse } from "starknet";
import { GameData } from "@/app/components/GameData";
import { FormData, NullAdventurer, UpgradeStats } from "@/app/types";
import { useContracts } from "@/app/hooks/useContracts";
import {
  useAccount,
  useContractWrite,
  useTransactionManager,
  useWaitForTransaction,
} from "@starknet-react/core";
import useTransactionCartStore from "@/app/hooks/useTransactionCartStore";
import useLoadingStore from "@/app/hooks/useLoadingStore";
import useUIStore from "@/app/hooks/useUIStore";
import { QueryKey, useQueriesStore } from "@/app/hooks/useQueryStore";
import { getKeyFromValue, stringToFelt, getRandomNumber } from ".";
import { parseEvents } from "./parseEvents";
import useAdventurerStore from "@/app/hooks/useAdventurerStore";

export function Syscalls() {
  const gameData = new GameData();

  const { gameContract, lordsContract } = useContracts();
  const { addTransaction } = useTransactionManager();
  const { account } = useAccount();
  const { data: queryData, resetData, setData } = useQueriesStore();

  const formatAddress = account ? account.address : "0x0";
  const adventurer = useAdventurerStore((state) => state.adventurer);
  const addToCalls = useTransactionCartStore((state) => state.addToCalls);
  const calls = useTransactionCartStore((state) => state.calls);
  const handleSubmitCalls = useTransactionCartStore(
    (state) => state.handleSubmitCalls
  );
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);
  const setTxAccepted = useLoadingStore((state) => state.setTxAccepted);
  const hash = useLoadingStore((state) => state.hash);
  const setTxHash = useLoadingStore((state) => state.setTxHash);
  const { writeAsync } = useContractWrite({ calls });
  const equipItems = useUIStore((state) => state.equipItems);
  const setEquipItems = useUIStore((state) => state.setEquipItems);
  const setDropItems = useUIStore((state) => state.setDropItems);
  const removeEntrypointFromCalls = useTransactionCartStore(
    (state) => state.removeEntrypointFromCalls
  );

  const spawn = async (formData: FormData) => {
    const mintLords = {
      contractAddress: lordsContract?.address ?? "",
      entrypoint: "mint",
      calldata: [formatAddress, (100 * 10 ** 18).toString(), "0"],
    };
    addToCalls(mintLords);

    const approveLordsTx = {
      contractAddress: lordsContract?.address ?? "",
      entrypoint: "approve",
      calldata: [gameContract?.address ?? "", (100 * 10 ** 18).toString(), "0"],
    };
    addToCalls(approveLordsTx);

    const mintAdventurerTx = {
      contractAddress: gameContract?.address ?? "",
      entrypoint: "start",
      calldata: [
        "0x0628d41075659afebfc27aa2aab36237b08ee0b112debd01e56d037f64f6082a",
        getKeyFromValue(gameData.ITEMS, formData.startingWeapon) ?? "",
        stringToFelt(formData.name).toString(),
        getRandomNumber(8000),
        getKeyFromValue(gameData.CLASSES, formData.class) ?? "",
        "1",
        formData.startingStrength,
        formData.startingDexterity,
        formData.startingVitality,
        formData.startingIntelligence,
        formData.startingWisdom,
        formData.startingCharisma,
      ],
    };

    addToCalls(mintAdventurerTx);
    startLoading(
      "Create",
      "Spawning Adventurer",
      "adventurersByOwnerQuery",
      undefined,
      `You have spawned ${formData.name}!`
    );
    const tx = await handleSubmitCalls(writeAsync);
    setTxHash(tx.transaction_hash);
    addTransaction({
      hash: tx?.transaction_hash,
      metadata: {
        method: `Spawn ${formData.name}`,
      },
    });
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });
    const events = parseEvents(receipt as InvokeTransactionReceiptResponse, {
      name: formData["name"],
      homeRealm: formData["homeRealmId"],
      classType: formData["class"],
      entropy: 0,
      createdTime: new Date(),
    });
    const adventurerState = events.find((event) => event.name === "StartGame")
      .data[0];
    setData("adventurersByOwnerQuery", {
      adventurers: [
        ...(queryData.adventurersByOwnerQuery?.adventurers ?? []),
        adventurerState,
      ],
    });
    setData("adventurerByIdQuery", {
      adventurers: [adventurerState],
    });
    setData("latestDiscoveriesQuery", {
      discoveries: [
        events.find((event) => event.name === "AmbushedByBeast").data[1],
      ],
    });
    setData("beastQuery", {
      beasts: [
        events.find((event) => event.name === "AmbushedByBeast").data[2],
      ],
    });
    setData("battlesByBeastQuery", {
      battles: [
        events.find((event) => event.name === "AmbushedByBeast").data[3],
      ],
    });
    setData("itemsByAdventurerQuery", {
      items: [
        {
          item: adventurerState.weapon,
          adventurerId: adventurerState["id"],
          owner: true,
          equipped: true,
          ownerAddress: adventurerState["owner"],
          xp: 0,
          special1: null,
          special2: null,
          special3: null,
          isAvailable: false,
          purchasedTime: null,
          timestamp: new Date(),
        },
      ],
    });
    stopLoading(`You have spawned ${formData.name}!`);
  };

  const explore = async (till_beast: boolean) => {
    addToCalls({
      contractAddress: gameContract?.address ?? "",
      entrypoint: "explore",
      calldata: [adventurer?.id?.toString() ?? "", "0", till_beast ? "1" : "0"],
    });
    startLoading(
      "Explore",
      "Exploring",
      "discoveryByTxHashQuery",
      adventurer?.id
    );

    const tx = await handleSubmitCalls(writeAsync);
    setTxHash(tx.transaction_hash);
    addTransaction({
      hash: tx.transaction_hash,
      metadata: {
        method: `Explore with ${adventurer?.name}`,
      },
    });
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });

    const events = parseEvents(
      receipt as InvokeTransactionReceiptResponse,
      queryData.adventurerByIdQuery?.adventurers[0] ?? NullAdventurer
    );
    const discoveries = [];

    const filteredDiscoveries = events.filter(
      (event) =>
        event.name === "DiscoveredHealth" ||
        event.name === "DiscoveredGold" ||
        event.name === "DiscoveredXP" ||
        event.name === "DodgedObstacle" ||
        event.name === "HitByObstacle"
    );
    if (filteredDiscoveries.length > 0) {
      for (let discovery of filteredDiscoveries) {
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        discoveries.unshift(discovery.data[1]);
      }
    }

    const filteredBeastDiscoveries = events.filter(
      (event) =>
        event.name === "DiscoveredBeast" || event.name === "AmbushedByBeast"
    );
    if (filteredBeastDiscoveries.length > 0) {
      for (let discovery of filteredBeastDiscoveries) {
        setData("battlesByBeastQuery", {
          battles: null,
        });
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        discoveries.unshift(discovery.data[1]);
        setData("beastQuery", { beasts: [discovery.data[2]] });
      }
    }

    const filteredBeastAmbushes = events.filter(
      (event) => event.name === "AmbushedByBeast"
    );
    if (filteredBeastAmbushes.length > 0) {
      setData("battlesByBeastQuery", {
        battles: null,
      });
      for (let discovery of filteredBeastAmbushes) {
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        discoveries.unshift(discovery.data[1]);
        setData("beastQuery", { beasts: [discovery.data[2]] });
        setData("battlesByBeastQuery", {
          battles: [discovery.data[3]],
        });
      }
    }

    const adventurerDiedExists = events.some((event) => {
      if (event.name === "AdventurerDied") {
        return true;
      }
      return false;
    });
    if (adventurerDiedExists) {
      const adventurerDiedEvent = events.find(
        (event) => event.name === "AdventurerDied"
      );
      setData("adventurerByIdQuery", {
        adventurers: [adventurerDiedEvent.data],
      });
    }

    const filteredDeathPenalty = events.filter(
      (event) => event.name === "IdleDeathPenalty"
    );
    if (filteredDeathPenalty.length > 0) {
      for (let discovery of filteredDeathPenalty) {
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        discoveries.unshift(discovery.data[2]);
      }
    }

    const newItemsAvailableExists = events.some((event) => {
      if (event.name === "NewItemsAvailable") {
        return true;
      }
      return false;
    });
    if (newItemsAvailableExists) {
      const newItemsAvailableEvent = events.find(
        (event) => event.name === "NewItemsAvailable"
      );
      const newItems = newItemsAvailableEvent.data[1];
      const itemData = [];
      for (let newItem of newItems) {
        itemData.unshift({
          item: newItem,
          adventurerId: newItemsAvailableEvent.data[0]["id"],
          owner: false,
          equipped: false,
          ownerAddress: newItemsAvailableEvent.data[0]["owner"],
          xp: 0,
          special1: null,
          special2: null,
          special3: null,
          isAvailable: false,
          purchasedTime: null,
          timestamp: new Date(),
        });
      }
      setData("latestMarketItemsQuery", {
        items: itemData,
      });
    }
    setData("latestDiscoveriesQuery", {
      discoveries: [
        ...discoveries,
        ...(queryData.latestDiscoveriesQuery?.discoveries ?? []),
      ],
    });
    setData("discoveryByTxHashQuery", {
      discoveries: [...discoveries.reverse()],
    });
    setEquipItems([]);
    setDropItems([]);
    stopLoading(discoveries);
  };

  const attack = async (tillDeath: boolean, beastData: any) => {
    resetData("latestMarketItemsQuery");
    addToCalls({
      contractAddress: gameContract?.address ?? "",
      entrypoint: "attack",
      calldata: [adventurer?.id?.toString() ?? "", "0", tillDeath ? "1" : "0"],
    });
    startLoading(
      "Attack",
      "Attacking",
      "battlesByTxHashQuery",
      adventurer?.id,
      { beast: beastData }
    );
    const tx = await handleSubmitCalls(writeAsync);
    setTxHash(tx.transaction_hash);
    addTransaction({
      hash: tx.transaction_hash,
      metadata: {
        method: `Attack ${beastData.beast}`,
      },
    });
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });

    // reset battles by tx hash
    setData("battlesByTxHashQuery", {
      battles: null,
    });

    const events = parseEvents(
      receipt as InvokeTransactionReceiptResponse,
      queryData.adventurerByIdQuery?.adventurers[0] ?? NullAdventurer
    );
    const battles = [];

    const attackedBeastEvents = events.filter(
      (event) => event.name === "AttackedBeast"
    );
    for (let attackedBeastEvent of attackedBeastEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [attackedBeastEvent.data[0]],
      });
      battles.unshift(attackedBeastEvent.data[1]);
      setData(
        "beastQuery",
        attackedBeastEvent.data[0].beastHealth,
        "health",
        0
      );
    }

    const attackedByBeastEvents = events.filter(
      (event) => event.name === "AttackedByBeast"
    );
    for (let attackedByBeastEvent of attackedByBeastEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [attackedByBeastEvent.data[0]],
      });
      battles.unshift(attackedByBeastEvent.data[1]);
    }

    const slayedBeastEvents = events.filter(
      (event) => event.name === "SlayedBeast"
    );
    for (let slayedBeastEvent of slayedBeastEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [slayedBeastEvent.data[0]],
      });
      battles.unshift(slayedBeastEvent.data[1]);
      setData("beastQuery", slayedBeastEvent.data[0].beastHealth, "health", 0);
    }
    setData("battlesByBeastQuery", {
      battles: [
        ...battles,
        ...(queryData.battlesByAdventurerQuery?.battles ?? []),
      ],
    });
    setData("battlesByAdventurerQuery", {
      battles: [
        ...battles,
        ...(queryData.battlesByAdventurerQuery?.battles ?? []),
      ],
    });
    setData("battlesByTxHashQuery", {
      battles: [...battles.reverse()],
    });

    const adventurerDiedExists = events.some((event) => {
      if (event.name === "AdventurerDied") {
        return true;
      }
      return false;
    });
    if (adventurerDiedExists) {
      const adventurerDiedEvent = events.find(
        (event) => event.name === "AdventurerDied"
      );
      setData("adventurerByIdQuery", {
        adventurers: [adventurerDiedEvent.data],
      });
    }

    const filteredDeathPenalty = events.filter(
      (event) => event.name === "IdleDeathPenalty"
    );
    if (filteredDeathPenalty.length > 0) {
      for (let discovery of filteredDeathPenalty) {
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        battles.unshift(discovery.data[1]);
      }
    }

    const newItemsAvailableExists = events.some((event) => {
      if (event.name === "NewItemsAvailable") {
        return true;
      }
      return false;
    });
    if (newItemsAvailableExists) {
      const newItemsAvailableEvent = events.find(
        (event) => event.name === "NewItemsAvailable"
      );
      const newItems = newItemsAvailableEvent.data[1];
      const itemData = [];
      for (let newItem of newItems) {
        itemData.unshift({
          item: newItem,
          adventurerId: newItemsAvailableEvent.data[0]["id"],
          owner: false,
          equipped: false,
          ownerAddress: newItemsAvailableEvent.data[0]["owner"],
          xp: 0,
          special1: null,
          special2: null,
          special3: null,
          isAvailable: false,
          purchasedTime: null,
          timestamp: new Date(),
        });
      }
      setData("latestMarketItemsQuery", {
        items: itemData,
      });
    }
    stopLoading(battles);
    setEquipItems([]);
    setDropItems([]);
  };

  const flee = async (tillDeath: boolean, beastData: any) => {
    addToCalls({
      contractAddress: gameContract?.address ?? "",
      entrypoint: "flee",
      calldata: [adventurer?.id?.toString() ?? "", "0", tillDeath ? "1" : "0"],
    });
    startLoading("Flee", "Fleeing", "battlesByTxHashQuery", adventurer?.id, {
      beast: beastData,
    });
    const tx = await handleSubmitCalls(writeAsync);
    setTxHash(tx.transaction_hash);
    addTransaction({
      hash: tx.transaction_hash,
      metadata: {
        method: `Flee ${beastData.beast}`,
      },
    });
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });
    // Add optimistic data
    const events = parseEvents(
      receipt as InvokeTransactionReceiptResponse,
      queryData.adventurerByIdQuery?.adventurers[0] ?? NullAdventurer
    );
    const battles = [];

    const fleeFailedEvents = events.filter(
      (event) => event.name === "FleeFailed"
    );
    for (let fleeFailedEvent of fleeFailedEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [fleeFailedEvent.data[0]],
      });
      battles.unshift(fleeFailedEvent.data[1]);
    }

    const attackedByBeastEvents = events.filter(
      (event) => event.name === "AttackedByAdventurer"
    );
    for (let attackedByBeastEvent of attackedByBeastEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [attackedByBeastEvent.data[0]],
      });
      battles.unshift(attackedByBeastEvent.data[1]);
    }

    const fleeSucceededEvents = events.filter(
      (event) => event.name === "FleeSucceeded"
    );
    for (let fleeSucceededEvent of fleeSucceededEvents) {
      setData("adventurerByIdQuery", {
        adventurers: [fleeSucceededEvent.data[0]],
      });
      battles.unshift(fleeSucceededEvent.data[1]);
    }

    const adventurerDiedExists = events.some((event) => {
      if (event.name === "AdventurerDied") {
        return true;
      }
      return false;
    });
    if (adventurerDiedExists) {
      const adventurerDiedEvent = events.find(
        (event) => event.name === "AdventurerDied"
      );
      setData("adventurerByIdQuery", {
        adventurers: [adventurerDiedEvent.data],
      });
    }

    const filteredDeathPenalty = events.filter(
      (event) => event.name === "IdleDeathPenalty"
    );
    if (filteredDeathPenalty.length > 0) {
      for (let discovery of filteredDeathPenalty) {
        setData("adventurerByIdQuery", {
          adventurers: [discovery.data[0]],
        });
        battles.unshift(discovery.data[1]);
      }
    }

    const newItemsAvailableExists = events.some((event) => {
      if (event.name === "NewItemsAvailable") {
        return true;
      }
      return false;
    });
    if (newItemsAvailableExists) {
      const newItemsAvailableEvent = events.find(
        (event) => event.name === "NewItemsAvailable"
      );
      const newItems = newItemsAvailableEvent.data[1];
      const itemData = [];
      for (let newItem of newItems) {
        itemData.unshift({
          item: newItem,
          adventurerId: newItemsAvailableEvent.data[0]["id"],
          owner: false,
          equipped: false,
          ownerAddress: newItemsAvailableEvent.data[0]["owner"],
          xp: 0,
          special1: null,
          special2: null,
          special3: null,
          isAvailable: false,
          purchasedTime: null,
          timestamp: new Date(),
        });
      }
      setData("latestMarketItemsQuery", {
        items: itemData,
      });
    }

    stopLoading(battles);
    setEquipItems([]);
    setDropItems([]);
  };

  const upgrade = async (
    upgrades: UpgradeStats,
    purchaseItems: any[],
    potionAmount: number
  ) => {
    startLoading(
      "Upgrade",
      "Upgrading",
      "adventurerByIdQuery",
      adventurer?.id,
      {
        Stats: upgrades,
        Items: purchaseItems,
        Potions: potionAmount,
      }
    );
    const tx = await handleSubmitCalls(writeAsync);
    setTxHash(tx.transaction_hash);
    addTransaction({
      hash: tx.transaction_hash,
      metadata: {
        method: `Upgrade`,
      },
    });
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });

    // Add optimistic data
    const events = parseEvents(
      receipt as InvokeTransactionReceiptResponse,
      queryData.adventurerByIdQuery?.adventurers[0] ?? NullAdventurer
    );
    // Update adventurer
    setData("adventurerByIdQuery", {
      adventurers: [
        events.find((event) => event.name === "AdventurerUpgraded").data,
      ],
    });

    // Add purchased items
    const eventPurchasedItemsEvent = events.find(
      (event) => event.name === "PurchasedItems"
    );
    setData("itemsByAdventurerQuery", {
      items: [
        ...(queryData.itemsByAdventurerQuery?.items ?? []),
        eventPurchasedItemsEvent.data[1],
      ],
    });
    const equippedItemsEvent = events.find(
      (event) => event.name === "EquippedItems"
    );
    const equippedItems = [];
    for (let equippedItem of equippedItemsEvent.data[1]) {
      const ownedItem = eventPurchasedItemsEvent.data[1].find(
        (item: any) => item.item == equippedItem
      );
      equippedItems.unshift({
        ...ownedItem,
        ["equipped"]: true,
      });
    }
    setData("itemsByAdventurerQuery", {
      items: [
        ...(queryData.itemsByAdventurerQuery?.items ?? []),
        ...equippedItems,
      ],
    });
    for (let unequippedItem of equippedItemsEvent.data[2]) {
      const ownedItemIndex = queryData.itemsByAdventurerQuery?.items.findIndex(
        (item) => item.item == unequippedItem
      );
      setData("itemsByAdventurerQuery", false, "equipped", ownedItemIndex);
    }
    // Reset items to no availability
    setData("latestMarketItemsQuery", null);
    stopLoading({
      Stats: upgrades,
      Items: purchaseItems,
      Potions: potionAmount,
    });
  };

  const multicall = async (
    loadingMessage: string[],
    loadingQuery: QueryKey | null,
    notification: string[]
  ) => {
    const items: string[] = [];

    for (const dict of calls) {
      if (
        dict.hasOwnProperty("entrypoint") &&
        (dict["entrypoint"] === "bid_on_item" ||
          dict["entrypoint"] === "claim_item")
      ) {
        if (Array.isArray(dict.calldata)) {
          items.unshift(dict.calldata[0]?.toString() ?? "");
        }
      }
      if (dict["entrypoint"] === "equip") {
        if (Array.isArray(dict.calldata)) {
          items.unshift(dict.calldata[2]?.toString() ?? "");
        }
      }
    }
    startLoading(
      "Multicall",
      loadingMessage,
      loadingQuery,
      adventurer?.id,
      notification
    );

    const tx = await handleSubmitCalls(writeAsync);
    const receipt = await account?.waitForTransaction(tx.transaction_hash, {
      retryInterval: 1000,
    });
    setTxHash(tx?.transaction_hash);
    addTransaction({
      hash: tx.transaction_hash,
      metadata: {
        method: "Multicall",
        marketIds: items,
      },
    });
    const events = parseEvents(
      receipt as InvokeTransactionReceiptResponse,
      queryData.adventurerByIdQuery?.adventurers[0] ?? NullAdventurer
    );
  };

  return { spawn, explore, attack, flee, upgrade, multicall };
}
