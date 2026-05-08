export type LoginResponse = {
  ok: boolean;
  token: string;
  user: {
    id: string;
    nome: string;
    role: "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";
  };
};

export type RegisterResponse = {
  ok: boolean;
};
