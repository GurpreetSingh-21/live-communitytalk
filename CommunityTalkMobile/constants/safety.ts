export const TOXIC_KEYWORDS = [
    // Profanity
    'stupid', 'idiot', 'ugly', 'trash', 'bitch', 'asshole', 'fuck', 'shit', 'scam', 'fake',
    'dick', 'pussy', 'cunt', 'whore', 'slut', 'bastard', 'damn', 'crap', 'douche',
    'faggot', 'nigger', 'nigga', 'retard', 'spastic', 
    
    // Aggression/Hate
    'kill', 'die', 'hate you', 'kill yourself', 'kys', 'fat', 'gross', 'disgusting',
    'loser', 'pathetic', 'worthless',
    
    // Sexual / Inappropriate
    'sex', 'nudes', 'naked', 'horny', 'hookup', 'dtf', 'fwb', 'boobs', 'tits', 
    'cock', 'penis', 'vagina', 'anal', 'oral', 'blowjob', 'handjob', 'cum', 'sperm',
    'porn', 'xxx', 'onlyfans',
    
    // Gen Z / Slang (Context dependent but flagging for safety)
    'simp', 'incel', 'thot', 'cap', 'mid', 'sussy', 'gyat' // Examples, might need refinement
];

export const checkMessageToxicity = (text: string): boolean => {
    const lower = text.toLowerCase();
    return TOXIC_KEYWORDS.some(keyword => lower.includes(keyword));
};
