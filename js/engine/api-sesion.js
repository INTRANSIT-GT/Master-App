/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  login(usuario,clave){
    const u=DB.usuarios.find(x=>x.usuario===String(usuario||'').trim().toLowerCase()&&String(x.clave).toLowerCase()===String(clave||'').trim().toLowerCase());
    if(!u||!u.activo){
      auditAdd({entidad:'SEGURIDAD',accion:'LOGIN_FALLIDO',campo:'Usuario',nuevo:String(usuario||'').slice(0,30),por:{id:'-',nombre:String(usuario||'(vacío)').slice(0,30),rol:''}});save();
      throw new ApiError('LOGIN','Usuario o contraseña incorrectos.');
    }
    auditAdd({entidad:'SESION',accion:'Inicio de sesión',por:u});save();return u;
  },
  logout(uid){const A=DB.usuarios.find(x=>x.id===uid);if(A){auditAdd({entidad:'SESION',accion:'Cierre de sesión',por:A});save();}},
  permiso(uid,p){return hasPerm(DB.usuarios.find(x=>x.id===uid),p);},

  /* ----- lectura (siempre filtrada por alcance) ----- */
});
