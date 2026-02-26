import React, { useState, useEffect } from "react";
import { useWebSocketConnection } from "../hooks/useWebSocketConnection";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState("");
  const { sendMessage, lastMessage } = useWebSocketConnection();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sendMessage) {
      sendMessage(
        JSON.stringify({
          action: "checkPassword",
          password,
        })
      );
    }
  };

  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      if (data.type === "authResult") {
        if (data.success) {
          onSuccess();
          onClose();
        } else {
          alert("Невірний пароль");
        }
      }
    }
  }, [lastMessage, onClose, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-2xl w-11/12 sm:w-1/2 md:w-1/3">
        <h2 className="text-xl font-semibold text-black dark:text-white mb-6 text-center">
          Введіть пароль для доступу до налаштувань
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 text-black dark:text-white p-3 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 mb-6"
            placeholder="Пароль"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Підтвердити
          </button>
        </form>
        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-blue-600 dark:text-blue-400 hover:opacity-80"
        >
          Закрити
        </button>
      </div>
    </div>
  );
};

export default PasswordModal;
