export type LoginResponse = {
  ok: boolean;
  token: string;
  user: {
    id: string;
    nome: string;
    role: "CLIENTE" | "DIARISTA" | "ADMIN";
  };
};

export type RegisterResponse = {
  ok: boolean;
};
