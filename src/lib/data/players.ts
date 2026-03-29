import { calculatePrice, getRarity } from "../utils";
import type { Player, Position } from "../types";

function createPlayer(
  id: string,
  name: string,
  fullName: string,
  nationality: string,
  club: string,
  position: Position,
  age: number,
  overall: number,
  pace: number,
  shooting: number,
  passing: number,
  dribbling: number,
  defending: number,
  physical: number,
  goalkeeping: number,
  variant: Player["variant"] = "base"
): Player {
  const price = calculatePrice(overall);
  return {
    id,
    name,
    fullName,
    nationality,
    club,
    position,
    age,
    overall,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    goalkeeping,
    marketValue: variant === "icon" ? Math.round(price * 1.5) : price,
    variant,
    rarity: variant === "icon" ? "special" : getRarity(overall),
  };
}

// Stub with sample players - will be replaced with full 300 player database
export const PLAYERS: Player[] = [
  // GK
  createPlayer("courtois_01", "T. Courtois", "Thibaut Courtois", "🇧🇪", "Real Madrid", "GK", 32, 90, 48, 12, 38, 18, 32, 78, 90),
  createPlayer("alisson_01", "Alisson", "Alisson Becker", "🇧🇷", "Liverpool", "GK", 31, 89, 50, 13, 40, 20, 30, 75, 89),
  createPlayer("oblak_01", "J. Oblak", "Jan Oblak", "🇸🇮", "Atletico", "GK", 31, 88, 45, 10, 35, 15, 28, 72, 88),
  createPlayer("ederson_01", "Ederson", "Ederson Moraes", "🇧🇷", "Man City", "GK", 30, 87, 60, 15, 55, 20, 25, 70, 86),
  createPlayer("neuer_01", "M. Neuer", "Manuel Neuer", "🇩🇪", "Bayern", "GK", 38, 86, 45, 12, 42, 18, 22, 70, 86),
  // CB
  createPlayer("dias_01", "R. Dias", "Ruben Dias", "🇵🇹", "Man City", "CB", 27, 88, 62, 38, 58, 48, 89, 82, 10),
  createPlayer("vandijk_01", "V. van Dijk", "Virgil van Dijk", "🇳🇱", "Liverpool", "CB", 32, 90, 70, 42, 65, 55, 91, 86, 8),
  createPlayer("araujo_01", "R. Araujo", "Ronald Araujo", "🇺🇾", "Barcelona", "CB", 25, 86, 72, 35, 50, 42, 87, 84, 9),
  createPlayer("saliba_01", "W. Saliba", "William Saliba", "🇫🇷", "Arsenal", "CB", 23, 86, 68, 30, 55, 45, 88, 80, 8),
  createPlayer("bastoni_01", "A. Bastoni", "Alessandro Bastoni", "🇮🇹", "Inter", "CB", 25, 85, 60, 32, 68, 50, 86, 75, 9),
  createPlayer("kounde_01", "J. Kounde", "Jules Kounde", "🇫🇷", "Barcelona", "CB", 25, 85, 75, 35, 60, 55, 85, 72, 8),
  createPlayer("gvardiol_01", "J. Gvardiol", "Josko Gvardiol", "🇭🇷", "Man City", "CB", 22, 84, 70, 35, 62, 52, 84, 78, 8),
  createPlayer("upamecano_01", "D. Upamecano", "Dayot Upamecano", "🇫🇷", "Bayern", "CB", 25, 83, 72, 30, 48, 42, 82, 80, 7),
  createPlayer("romero_01", "C. Romero", "Cristian Romero", "🇦🇷", "Tottenham", "CB", 26, 83, 68, 32, 45, 48, 84, 78, 8),
  // LB
  createPlayer("davies_01", "A. Davies", "Alphonso Davies", "🇨🇦", "Bayern", "LB", 23, 84, 95, 42, 68, 78, 72, 70, 8),
  createPlayer("robertson_01", "A. Robertson", "Andrew Robertson", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Liverpool", "LB", 30, 84, 78, 38, 78, 68, 78, 75, 7),
  createPlayer("mendy_01", "F. Mendy", "Ferland Mendy", "🇫🇷", "Real Madrid", "LB", 29, 83, 82, 35, 58, 62, 80, 78, 8),
  createPlayer("theo_01", "T. Hernandez", "Theo Hernandez", "🇫🇷", "AC Milan", "LB", 26, 85, 90, 65, 68, 72, 70, 78, 7),
  // RB
  createPlayer("alexander_arnold_01", "T. Alexander-Arnold", "Trent Alexander-Arnold", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Liverpool", "RB", 25, 87, 72, 58, 90, 72, 68, 65, 7),
  createPlayer("hakimi_01", "A. Hakimi", "Achraf Hakimi", "🇲🇦", "PSG", "RB", 25, 85, 92, 55, 72, 78, 72, 70, 7),
  createPlayer("cancelo_01", "J. Cancelo", "Joao Cancelo", "🇵🇹", "Barcelona", "RB", 30, 84, 82, 58, 78, 82, 68, 68, 7),
  createPlayer("walker_01", "K. Walker", "Kyle Walker", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Man City", "RB", 34, 82, 88, 38, 58, 55, 78, 78, 7),
  // CM
  createPlayer("bellingham_01", "J. Bellingham", "Jude Bellingham", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Real Madrid", "CM", 20, 91, 78, 82, 78, 85, 68, 78, 8),
  createPlayer("debruyne_01", "K. De Bruyne", "Kevin De Bruyne", "🇧🇪", "Man City", "CM", 33, 91, 72, 82, 93, 88, 52, 72, 7),
  createPlayer("pedri_01", "Pedri", "Pedro Gonzalez Lopez", "🇪🇸", "Barcelona", "CM", 21, 88, 70, 65, 88, 88, 62, 60, 8),
  createPlayer("rodri_01", "Rodri", "Rodrigo Hernandez", "🇪🇸", "Man City", "CM", 28, 90, 58, 65, 82, 78, 88, 82, 7),
  createPlayer("valverde_01", "F. Valverde", "Federico Valverde", "🇺🇾", "Real Madrid", "CM", 25, 88, 82, 75, 78, 78, 72, 80, 8),
  createPlayer("barella_01", "N. Barella", "Nicolo Barella", "🇮🇹", "Inter", "CM", 27, 86, 72, 70, 82, 78, 76, 75, 7),
  createPlayer("rice_01", "D. Rice", "Declan Rice", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Arsenal", "CM", 25, 86, 68, 58, 72, 68, 85, 80, 7),
  createPlayer("gavi_01", "Gavi", "Pablo Paez Gavira", "🇪🇸", "Barcelona", "CM", 19, 82, 72, 55, 78, 80, 68, 72, 7),
  createPlayer("camavinga_01", "E. Camavinga", "Eduardo Camavinga", "🇫🇷", "Real Madrid", "CM", 21, 82, 72, 55, 72, 78, 75, 78, 8),
  // LW
  createPlayer("mbappe_01", "K. Mbappe", "Kylian Mbappe", "🇫🇷", "Real Madrid", "LW", 25, 92, 97, 90, 80, 92, 30, 72, 5),
  createPlayer("vinicius_01", "Vinicius Jr", "Vinicius Junior", "🇧🇷", "Real Madrid", "LW", 24, 90, 95, 78, 68, 92, 28, 65, 5),
  createPlayer("neymar_01", "Neymar", "Neymar Jr", "🇧🇷", "Al Hilal", "LW", 32, 87, 82, 78, 82, 92, 25, 52, 5),
  createPlayer("leao_01", "R. Leao", "Rafael Leao", "🇵🇹", "AC Milan", "LW", 24, 86, 92, 75, 68, 86, 22, 62, 5),
  createPlayer("son_01", "Son H-M", "Son Heung-min", "🇰🇷", "Tottenham", "LW", 31, 87, 88, 85, 72, 82, 30, 65, 5),
  // RW
  createPlayer("salah_01", "M. Salah", "Mohamed Salah", "🇪🇬", "Liverpool", "RW", 32, 89, 88, 88, 78, 88, 30, 70, 5),
  createPlayer("saka_01", "B. Saka", "Bukayo Saka", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Arsenal", "RW", 22, 87, 85, 78, 78, 85, 42, 62, 5),
  createPlayer("dembele_01", "O. Dembele", "Ousmane Dembele", "🇫🇷", "PSG", "RW", 27, 85, 90, 72, 78, 88, 28, 55, 5),
  createPlayer("foden_01", "P. Foden", "Phil Foden", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Man City", "RW", 24, 87, 82, 80, 82, 88, 38, 58, 5),
  // ST
  createPlayer("haaland_01", "E. Haaland", "Erling Haaland", "🇳🇴", "Man City", "ST", 24, 91, 88, 92, 52, 72, 38, 88, 5),
  createPlayer("kane_01", "H. Kane", "Harry Kane", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Bayern", "ST", 31, 90, 68, 90, 82, 78, 42, 78, 5),
  createPlayer("lewandowski_01", "R. Lewandowski", "Robert Lewandowski", "🇵🇱", "Barcelona", "ST", 36, 88, 62, 90, 72, 82, 32, 78, 5),
  createPlayer("osimhen_01", "V. Osimhen", "Victor Osimhen", "🇳🇬", "Napoli", "ST", 25, 87, 88, 85, 48, 72, 28, 78, 5),
  createPlayer("lautaro_01", "L. Martinez", "Lautaro Martinez", "🇦🇷", "Inter", "ST", 26, 86, 78, 85, 58, 78, 35, 75, 5),
  createPlayer("nunez_01", "D. Nunez", "Darwin Nunez", "🇺🇾", "Liverpool", "ST", 24, 84, 90, 78, 48, 72, 25, 80, 5),
  // Icons
  createPlayer("zidane_icon", "Zidane", "Zinedine Zidane", "🇫🇷", "Legend", "CM", 99, 92, 78, 78, 90, 95, 55, 78, 5, "icon"),
  createPlayer("r9_icon", "Ronaldo", "Ronaldo Nazario", "🇧🇷", "Legend", "ST", 99, 93, 92, 95, 62, 92, 28, 78, 5, "icon"),
  createPlayer("henry_icon", "Henry", "Thierry Henry", "🇫🇷", "Legend", "ST", 99, 92, 95, 90, 72, 90, 30, 70, 5, "icon"),
  createPlayer("maldini_icon", "Maldini", "Paolo Maldini", "🇮🇹", "Legend", "CB", 99, 91, 70, 32, 72, 58, 95, 82, 8, "icon"),
  createPlayer("ronaldinho_icon", "Ronaldinho", "Ronaldinho Gaucho", "🇧🇷", "Legend", "LW", 99, 91, 82, 78, 85, 95, 25, 70, 5, "icon"),
  createPlayer("beckham_icon", "Beckham", "David Beckham", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Legend", "CM", 99, 89, 68, 72, 92, 78, 58, 72, 5, "icon"),
  createPlayer("yashin_icon", "Yashin", "Lev Yashin", "🇷🇺", "Legend", "GK", 99, 90, 35, 10, 30, 15, 38, 75, 92, "icon"),
];

export function getPlayersByPosition(position: Position): Player[] {
  return PLAYERS.filter((p) => p.position === position);
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function searchPlayers(query: string): Player[] {
  const q = query.toLowerCase();
  return PLAYERS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.club.toLowerCase().includes(q)
  );
}
