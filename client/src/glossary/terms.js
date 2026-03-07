/**
 * In-app glossary: short definitions for fantasy baseball terms.
 * Used by GlossaryTerm (tooltips) and GlossaryModal (full list).
 */
export const GLOSSARY_TERMS = [
  {
    term: 'SP',
    definition: 'Starting Pitcher. A pitcher who begins the game and typically throws multiple innings. SPs contribute Wins (W), Strikeouts (K), ERA, and WHIP.',
  },
  {
    term: 'RP',
    definition: 'Relief Pitcher. A pitcher who enters after the starter, often for one inning or a save situation. Closers are RPs who earn Saves (SV).',
  },
  {
    term: 'Categories',
    definition: 'Scoring categories your league uses (e.g. HR, RBI, R, SB, AVG for batters; W, SV, K, ERA, WHIP for pitchers). Player values depend on how well they help in these categories.',
  },
  {
    term: 'Scarcity',
    definition: 'How few good options remain at a position. When a position is scarce (e.g. only 3 closers left), remaining players may cost more because many teams still need that slot.',
  },
  {
    term: 'Inflation',
    definition: 'In auction drafts, when keeper salaries reduce the money in the room, remaining players get bid up. Inflation is the percentage by which dollar values rise above "baseline" values.',
  },
  {
    term: 'Value',
    definition: 'A player\'s projected contribution in your league\'s scoring system. Often shown as fantasy points (FPTS) or an auction dollar value ($) based on projections and league settings.',
  },
  {
    term: 'ADP',
    definition: 'Average Draft Position. The typical round or pick where a player is drafted across many leagues. Helps you see if someone is going earlier or later than usual.',
  },
  {
    term: 'FPTS',
    definition: 'Fantasy Points. A single number summarizing a player\'s projected (or actual) stats based on your league\'s scoring. Used to rank and value players.',
  },
  {
    term: 'ERA',
    definition: 'Earned Run Average. Average earned runs a pitcher allows per nine innings. Lower is better. (Pitchers only.)',
  },
  {
    term: 'WHIP',
    definition: 'Walks + Hits per Inning Pitched. Measures how many baserunners a pitcher allows. Lower is better. (Pitchers only.)',
  },
  {
    term: 'Closer',
    definition: 'A relief pitcher who pitches the last inning in a close game to earn a Save (SV). SV is a common fantasy category; closers are scarce and often expensive.',
  },
  {
    term: 'Position eligibility',
    definition: 'Which roster slots a player can fill (e.g. OF, 1B). Multi-eligible players add flexibility and reduce risk when filling your roster.',
  },
  {
    term: 'Roster slot',
    definition: 'A required position on your roster (e.g. 2 C, 5 OF, 2 SP, 2 RP). The draft kit helps you fill each slot within your budget.',
  },
  {
    term: 'Auction draft',
    definition: 'Each team has a budget (e.g. $260). You nominate players and bid; the high bidder wins the player and that amount is subtracted from their budget. No snake order.',
  },
    {
    term: 'AVG',
    definition: 'Batting Average. Hits divided by at-bats. Higher is better. A common hitting category in roto/category leagues.',
  },
  {
    term: 'OBP',
    definition: 'On-Base Percentage. Measures how often a hitter reaches base by hit, walk, or hit-by-pitch. Higher is better.',
  },
  {
    term: 'SLG',
    definition: 'Slugging Percentage. Measures power by weighting extra-base hits more heavily than singles. Higher is better.',
  },
  {
    term: 'OPS',
    definition: 'On-Base Plus Slugging. OBP plus SLG. A quick way to measure overall hitting production.',
  },
  {
    term: 'HR',
    definition: 'Home Runs. A major power category for hitters. Players with strong HR totals often also help in RBI and Runs.',
  },
  {
    term: 'R',
    definition: 'Runs scored. A hitter earns a Run when they cross home plate. Often influenced by lineup spot and team offense.',
  },
  {
    term: 'RBI',
    definition: 'Runs Batted In. Counts how many runners a hitter drives home. Middle-of-the-order hitters often contribute heavily here.',
  },
  {
    term: 'SB',
    definition: 'Stolen Bases. A speed category for hitters. Players with high SB totals can be especially valuable because speed is often scarce.',
  },
  {
    term: 'QS',
    definition: 'Quality Start. A starting pitcher gets a QS by pitching at least 6 innings and allowing 3 or fewer earned runs. Some leagues use QS instead of Wins.',
  },
  {
    term: 'W',
    definition: 'Wins. A pitching category awarded when a pitcher is the pitcher of record when his team takes the lead for good.',
  },
  {
    term: 'SV',
    definition: 'Saves. Awarded to a relief pitcher who finishes a close game under save conditions. Closers are the main source of saves.',
  },
  {
    term: 'HLD',
    definition: 'Holds. Awarded to a relief pitcher who preserves a lead before the closer enters. Common in leagues that value setup relievers.',
  },
  {
    term: 'K',
    definition: 'Strikeouts. A pitcher category counting how many batters a pitcher strikes out. High-K pitchers are often highly valued.',
  },
  {
    term: 'IP',
    definition: 'Innings Pitched. Total innings a pitcher throws. Important because more innings usually create more chances for Wins and Strikeouts.',
  },
  {
    term: 'BAA',
    definition: 'Batting Average Against. The batting average hitters have against a pitcher. Lower is better.',
  },
  {
    term: 'BB',
    definition: 'Walks. For hitters, it can help OBP leagues. For pitchers, too many walks can hurt WHIP and overall effectiveness.',
  },
  {
    term: 'K/9',
    definition: 'Strikeouts per 9 innings. Shows how often a pitcher gets strikeouts relative to workload. Higher is better.',
  },
  {
    term: 'BB/9',
    definition: 'Walks per 9 innings. Measures pitcher control. Lower is better.',
  },
  {
    term: 'K/BB',
    definition: 'Strikeout-to-walk ratio. A strong indicator of pitcher skill and control. Higher is generally better.',
  },
  {
    term: 'Roster construction',
    definition: 'The overall balance of your team across positions, categories, and budget. Good roster construction means building a complete team rather than overloading one area.',
  },
  {
    term: 'Nomination',
    definition: 'In an auction draft, the player a manager puts up for bidding. Smart nominations can drain opponents budgets or create bargains.',
  },
  {
    term: 'Budget',
    definition: 'The amount of money a team has to spend in an auction draft. Every purchase reduces your remaining budget for later players.',
  },
  {
    term: 'Bid limit',
    definition: 'The maximum amount you can bid at a given time while still leaving at least $1 for each remaining open roster spot.',
  },
  {
    term: 'Keeper',
    definition: 'A player retained from a previous season, usually at a fixed round cost or salary. Keepers affect draft pools and auction inflation.',
  },
  {
    term: 'Sleeper',
    definition: 'A player being drafted later than their upside suggests. Sleepers are targets who can outperform their draft cost.',
  },
  {
    term: 'Bust',
    definition: 'A player who fails to return value relative to their draft cost, often because of poor performance, role loss, or injury.',
  },
  {
    term: 'Breakout',
    definition: 'A player expected to improve significantly beyond prior production. Breakout candidates often become strong value picks.',
  },
  {
    term: 'Floor',
    definition: 'A player’s safer, lower-end expected outcome. High-floor players offer stability but may have less upside.',
  },
  {
    term: 'Ceiling',
    definition: 'A player’s high-end potential outcome. High-ceiling players can win leagues if everything goes right.',
  },
  {
    term: 'Upside',
    definition: 'The potential for a player to outperform their draft cost by a large margin. Often tied to youth, skill growth, or opportunity.',
  },
  {
    term: 'Risk',
    definition: 'The chance a player underperforms due to injury, inconsistency, limited playing time, or uncertain role.',
  },
  {
    term: 'Tier',
    definition: 'A group of players with similar projected value. Tiers help identify drop-offs and decide when to wait or act quickly.',
  },
  {
    term: 'Replacement level',
    definition: 'The approximate value of the best player you could still add from waivers or the end of the draft. Used to measure how much value a drafted player adds above baseline.',
  },
  {
    term: 'Waiver wire',
    definition: 'The pool of undrafted or dropped players available to add during the season. A strong waiver wire can reduce the need to reach in the draft.',
  },
  {
    term: 'Streaming',
    definition: 'Regularly adding short-term players, often pitchers, for favorable matchups instead of holding them all season.',
  },
  {
    term: 'Handcuff',
    definition: 'A backup player rostered mainly to protect an investment in a starter or closer. More common when roles are unstable.',
  },
  {
    term: 'Prospect',
    definition: 'A young player with future upside who may not yet have a guaranteed MLB role. Prospects can carry high upside and high risk.',
  },
  {
    term: 'Platoon',
    definition: 'A situation where a player shares playing time based on handedness or matchups. Platoons can reduce plate appearances and fantasy value.',
  },
  {
    term: 'Playing time',
    definition: 'How often a player is expected to be in the lineup or on the mound. More playing time usually means more fantasy opportunity.',
  },
  {
    term: 'Volume',
    definition: 'Total opportunities a player gets, such as plate appearances or innings pitched. Volume matters a lot in fantasy value.',
  },
  {
    term: 'Positional run',
    definition: 'A stretch where many managers draft the same position in a short span. Runs can create scarcity and force decisions.',
  },
  {
    term: 'Reach',
    definition: 'Drafting a player earlier or at a higher price than their market value because you strongly want them.',
  },
  {
    term: 'Snipe',
    definition: 'Drafting or bidding on a player another manager was clearly targeting, often right before their expected pick or price point.',
  },
  {
    term: 'Punt',
    definition: 'Choosing to ignore or deprioritize a category during roster construction to focus resources elsewhere.',
  },
  {
    term: 'Balanced build',
    definition: 'A roster strategy that tries to stay competitive in all categories rather than dominating only a few.',
  },
  {
    term: 'Stars and scrubs',
    definition: 'An auction strategy where you spend heavily on elite players and fill the rest of the roster with low-cost options.',
  },
  {
    term: 'Depth',
    definition: 'The amount of usable talent across your roster, especially on the bench. Good depth helps cover injuries and slumps.',
  },
  {
    term: 'Bench bat',
    definition: 'A reserve hitter kept for matchup flexibility, injury protection, or upside.',
  },
  {
    term: 'Utility',
    definition: 'A roster slot that can usually be filled by any hitter, regardless of defensive position eligibility.',
  },
  {
    term: 'MI',
    definition: 'Middle Infield. A roster slot that can be filled by a 2B or SS.',
  },
  {
    term: 'CI',
    definition: 'Corner Infield. A roster slot that can be filled by a 1B or 3B.',
  },
  {
    term: 'OF',
    definition: 'Outfield. A hitter eligibility tag covering left field, center field, or right field.',
  },
  {
    term: 'C',
    definition: 'Catcher. A scarce fantasy position because there are fewer strong offensive options than at most other spots.',
  },
  {
    term: '1B',
    definition: 'First Base. A corner infield position often associated with power hitters.',
  },
  {
    term: '2B',
    definition: 'Second Base. A middle infield position that may offer batting average, runs, and speed depending on the player.',
  },
  {
    term: '3B',
    definition: 'Third Base. A corner infield position that often provides power and RBI.',
  },
  {
    term: 'SS',
    definition: 'Shortstop. A middle infield position that often combines power, speed, and lineup value.',
  },
  {
    term: 'OF depth',
    definition: 'The strength of the outfield player pool. Because leagues often start many OFs, depth and timing matter a lot here.',
  },
  {
    term: 'Anchor pitcher',
    definition: 'A reliable, high-end starting pitcher drafted to stabilize your ratios and strikeouts.',
  },
  {
    term: 'Ratios',
    definition: 'Rate-based pitching stats like ERA and WHIP. Unlike counting stats, ratios can be hurt by a few bad outings.',
  },
  {
    term: 'Counting stats',
    definition: 'Stats that accumulate in total, like HR, RBI, R, SB, W, SV, and K.',
  },
  {
    term: 'Projection',
    definition: 'An estimate of a player’s future performance based on skill, role, playing time, and historical data.',
  },
  {
    term: 'Market value',
    definition: 'The typical draft cost or auction price of a player based on ADP, rankings, or room behavior.',
  },
  {
    term: 'Roster fit',
    definition: 'How well a player complements your existing team in terms of categories, positions, and budget.',
  },
  {
    term: 'Target',
    definition: 'A player you plan to draft because their value, fit, or upside matches your strategy.',
  },
  {
    term: 'Fade',
    definition: 'A player you intentionally avoid because you believe their draft cost is too high or their risk is too great.',
  },
  {
    term: 'Post-hype sleeper',
    definition: 'A player once heavily hyped whose market price has fallen, creating a chance for profit if they rebound.',
  },
];

export const getDefinition = (term) => {
  const normalized = String(term || '').trim();
  const found = GLOSSARY_TERMS.find(
    (t) => t.term.toLowerCase() === normalized.toLowerCase()
  );
  return found ? found.definition : null;
};
