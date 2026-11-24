/* TypeLink 2 — Pokémon Black 2 / White 2 save parser (read-only)
 * TypeLink 2 uses Pokémon Black 2 / White 2.
 * Supports raw 512 KiB Gen 5 saves and DeSmuME .dsv files with the 122-byte footer.
 * The parser never modifies the uploaded buffer.
 */
(function(global){
  "use strict";

  const PK5_SIZE=136;
  const PARTY_SIZE=220;
  const BW_PC_OFFSET=0x24400;
  const B2W2_PC_OFFSET=0x400;
  const PARTY_OFFSET=0x18E08;
  const GAME_VERSION_OFFSET=0x1941F;
  const PARTY_COUNT=6;
  const BOX_COUNT=24;
  const BOX_SLOTS=30;
  const DSV_FOOTER_MARKER="|-DESMUME SAVE-|";

  const ORDERS=[
    [0,1,2,3],[0,1,3,2],[0,2,1,3],[0,2,3,1],[0,3,1,2],[0,3,2,1],
    [1,0,2,3],[1,0,3,2],[1,2,0,3],[1,2,3,0],[1,3,0,2],[1,3,2,0],
    [2,0,1,3],[2,0,3,1],[2,1,0,3],[2,1,3,0],[2,3,0,1],[2,3,1,0],
    [3,0,1,2],[3,0,2,1],[3,1,0,2],[3,1,2,0],[3,2,0,1],[3,2,1,0]
  ];

  function u16(b,o){return b[o]|(b[o+1]<<8);}
  function u32(b,o){return ((b[o])|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
  function utf16(b,o,count){
    let s="";
    for(let i=0;i<count;i++){
      const c=u16(b,o+i*2);
      if(c===0||c===0xffff)break;
      s+=String.fromCharCode(c);
    }
    return s;
  }
  function lcrngNext(seed){return (Math.imul(seed>>>0,0x41c64e6d)+0x6073)>>>0;}
  function xorRegion(b,seed,start=8,end=0x88){
    let s=seed>>>0;
    for(let o=start;o<end;o+=2){
      s=lcrngNext(s);
      const key=(s>>>16)&0xffff;
      const value=u16(b,o)^key;
      b[o]=value&255;b[o+1]=(value>>>8)&255;
    }
  }
  function decryptPk5(stored){
    const out=stored.slice(0,PK5_SIZE);
    const pid=u32(out,0);
    const checksum=u16(out,6);
    xorRegion(out,checksum);
    const idx=(((pid>>>13)&0x1f)%24);
    const order=ORDERS[idx];
    const blocks=[
      out.slice(8,40),out.slice(40,72),out.slice(72,104),out.slice(104,136)
    ];
    const canonical=new Array(4);
    for(let p=0;p<4;p++)canonical[order[p]]=blocks[p];
    for(let i=0;i<4;i++)out.set(canonical[i],8+i*32);
    return out;
  }
  function decryptBattleStats(stored){
    const out=stored.slice(0x88,0xD4);
    const pid=u32(stored,0);
    xorRegion(out,pid,0,0x4c);
    return out;
  }
  function isEmpty(stored){
    return u16(stored,6)===0;
  }
  function parsePokemon(stored,isParty){
    if(!stored||stored.length<PK5_SIZE||isEmpty(stored))return null;
    const d=decryptPk5(stored);
    const species=u16(d,8);
    const checksum=u16(stored,6);
    let calc=0;
    for(let o=8;o<PK5_SIZE;o+=2)calc=(calc+u16(d,o))&0xffff;
    if(!species||species>649||checksum!==calc)return null;
    const pid=u32(d,0);
    const ivs=u32(d,0x38);
    const pokemon={
      species_id:species,
      pid,
      nickname:utf16(d,0x48,11),
      nickname_is_custom:Boolean(ivs&0x80000000),
      level:null,
      exp:u32(d,0x10),
      held_item_id:u16(d,0x0A),
      ability_id:d[0x15],
      friendship:d[0x14],
      nature_id:d[0x41],
      is_egg:Boolean(ivs&0x40000000),
      gender_flag:d[0x40],
      form:(d[0x40]>>>3)&0x1f,
      shiny:((pid^u32(d,0x0c))&0xFFFF) < 8,
      moves:[u16(d,0x28),u16(d,0x2A),u16(d,0x2C),u16(d,0x2E)],
      evs:[d[0x18],d[0x19],d[0x1A],d[0x1B],d[0x1C],d[0x1D]],
      ivs:[
        ivs&31,(ivs>>>5)&31,(ivs>>>10)&31,(ivs>>>15)&31,(ivs>>>20)&31,(ivs>>>25)&31
      ]
    };
    if(isParty){
      const stats=decryptBattleStats(stored);
      pokemon.level=stats[4+0x88-0x88]; // level byte is at 0x8C => index 4
      pokemon.current_hp=u16(stats,0x8e-0x88);
      pokemon.max_hp=u16(stats,0x90-0x88);
    }
    return pokemon;
  }

  function normalizeSave(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
    if(bytes.length===0x80000)return bytes;
    if(bytes.length>0x80000){
      const tailStart=bytes.length-122;
      const marker=new TextDecoder("ascii",{fatal:false}).decode(bytes.slice(tailStart,Math.min(bytes.length,tailStart+16)));
      if(marker.includes(DSV_FOOTER_MARKER))return bytes.slice(0,0x80000);
      // Some emulators append non-standard data. The Gen 5 raw save is still the first 512 KiB.
      return bytes.slice(0,0x80000);
    }
    throw new Error("El archivo no tiene el tamaño esperado de una partida Gen 5 (512 KiB).");
  }

  function parseSave(input){
    const bytes=normalizeSave(input);
    if(bytes.length!==0x80000)throw new Error("La partida no tiene los 512 KiB esperados para una partida de Negro 2 / Blanco 2.");
    const gameVersion=bytes[GAME_VERSION_OFFSET];
    const isB2W2=gameVersion===22||gameVersion===23;
    if(!isB2W2){
      const detectedTitle=gameVersion===20?"Pokémon White":gameVersion===21?"Pokémon Black":"otra versión de Pokémon";
      throw new Error(`TypeLink 2 requiere una partida de Pokémon Negro 2 o Blanco 2. Se detectó: ${detectedTitle}.`);
    }
    const gameTitle=gameVersion===22?"Pokémon White 2":"Pokémon Black 2";
    const pcOffset=isB2W2?B2W2_PC_OFFSET:BW_PC_OFFSET;
    const trainer={
      name:utf16(bytes,0x19404,8),
      game_version:gameVersion,
      game_title:gameTitle,
      playtime_hours:u16(bytes,0x19424),
      playtime_minutes:bytes[0x19426],
      playtime_seconds:bytes[0x19427],
      money:u32(bytes,0x21200),
      badges:bytes[0x21204]
    };
    const party=[];
    for(let i=0;i<PARTY_COUNT;i++){
      const raw=bytes.slice(PARTY_OFFSET+i*PARTY_SIZE,PARTY_OFFSET+(i+1)*PARTY_SIZE);
      const mon=parsePokemon(raw,true);
      if(mon)party.push({...mon,slot:i+1});
    }
    const boxes=[];
    for(let box=0;box<BOX_COUNT;box++){
      const slots=[];
      const boxBase=pcOffset+box*0x1000;
      for(let slot=0;slot<BOX_SLOTS;slot++){
        const off=boxBase+slot*PK5_SIZE;
        const raw=bytes.slice(off,off+PK5_SIZE);
        const mon=parsePokemon(raw,false);
        slots.push(mon?{...mon,slot:slot+1}:null);
      }
      boxes.push({number:box+1,slots});
    }
    return {
      format:"gen5-b2w2",
      parser_version:"typelink-b2w2-1.1.0",
      trainer,
      game_title:gameTitle,
      party,
      boxes,
      box_count:BOX_COUNT,
      occupied_pc_slots:boxes.reduce((n,b)=>n+b.slots.filter(Boolean).length,0)
    };
  }

  global.TypeLinkGen5SaveParser={parseSave,normalizeSave};
})(window);
