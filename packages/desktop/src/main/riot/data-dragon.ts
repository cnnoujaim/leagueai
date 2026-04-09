interface ChampionData {
  id: string;
  key: string;
  name: string;
  title: string;
}

let championsByKey: Map<number, ChampionData> | null = null;
let currentVersion: string | null = null;

export async function getCurrentVersion(): Promise<string> {
  if (currentVersion) return currentVersion;

  const res = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  const versions = (await res.json()) as string[];
  currentVersion = versions[0];
  return currentVersion;
}

export async function getChampionByKey(
  championKey: number
): Promise<ChampionData | null> {
  if (!championsByKey) {
    await loadChampions();
  }
  return championsByKey?.get(championKey) ?? null;
}

export async function getChampionName(championKey: number): Promise<string> {
  const champ = await getChampionByKey(championKey);
  return champ?.name ?? `Unknown(${championKey})`;
}

async function loadChampions(): Promise<void> {
  const version = await getCurrentVersion();
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    data: Record<string, ChampionData & { key: string }>;
  };

  championsByKey = new Map();
  for (const champ of Object.values(data.data)) {
    championsByKey.set(parseInt(champ.key, 10), champ);
  }
}

export function clearDataDragonCache(): void {
  championsByKey = null;
  currentVersion = null;
}
