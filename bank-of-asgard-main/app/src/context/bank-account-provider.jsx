import PropTypes from "prop-types";
import { createContext, useState } from "react";

const BankAccountContext = createContext(null);

const BankAccountProvider = ({ children }) => {
  const initialAccountState = {
    accountNumber: "083434342982340",
    balance: 9565.50,
  };

  const [ bankAccountData, setBankAccountData ] = useState(initialAccountState);

  const updateBalance = (newBalance) => {
    setBankAccountData((prevValue) => ({
      ...prevValue,
      balance: newBalance,
    }));
  };

  return (
    <BankAccountContext.Provider value={{ bankAccountData, updateBalance }}>
      {children}
    </BankAccountContext.Provider>
  );
};

BankAccountProvider.propTypes = {
  children: PropTypes.node,
};

export { BankAccountContext, BankAccountProvider };
